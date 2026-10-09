async def run_test(page, output_dir, page_url):
    import json
    import os
    import re
    import time
    from datetime import datetime, timezone
    from pathlib import Path
    from playwright.async_api import expect
    from urllib.parse import urlparse

    artifact_path = "/app/test_reports/artifacts_iter67/igor_literal_purchase_verification.json"
    discovery_path = "/app/test_reports/artifacts_iter67/iter67_igor_territory_discovery.json"
    os.makedirs("/app/test_reports/artifacts_iter67", exist_ok=True)

    selected_agent_id = None
    selected_agent_name = ""
    verified_comune = None
    ai_calls = []
    blocked = []
    blocked_count = 0
    forwarded_writes = 0
    stop_for_quota = False
    pending_requests = 0
    load_timings = {}
    run_error = None
    turn_prompts = []
    selected_testid = None

    allowed_rpcs = {
        "ai_tour_order_stats",
        "ai_tour_contact_stats",
        "ai_tour_learned_durations",
        "ai_tour_no_interest_ids",
        "get_orphan_tabaccherie_ids",
        "ai_tour_free_tabaccherie",
        "tabaccherie_points_in_bbox",
    }
    blocked_mutation_hints = [
        "closeDueFollowUps",
        "reschedule",
        "toursave",
        "GPSheartbeat",
        "heartbeat",
        "/storage/",
    ]

    try:
        if os.path.exists(discovery_path):
            with open(discovery_path, "r", encoding="utf-8") as f:
                discovery = json.load(f)
            verified_comune = discovery.get("chosen_comune_verificato")
            selected_agent_id = discovery.get("selected_agent_id")
        if not verified_comune:
            raise Exception("Comune verificato assente dalla discovery: stop obbligatorio, niente fallback inventato")

        async def route_guard(route, request):
            nonlocal blocked_count, forwarded_writes, pending_requests, stop_for_quota
            method = request.method.upper()
            url = request.url
            parsed = urlparse(url)
            path = parsed.path

            pending_requests += 1
            try:
                if method in {"GET", "HEAD", "OPTIONS"}:
                    await route.continue_()
                    return

                if method == "POST" and path == "/auth/v1/token":
                    await route.continue_()
                    return

                if method == "POST" and path.startswith("/rest/v1/rpc/"):
                    rpc = path.split("/rpc/", 1)[1].split("?")[0]
                    if rpc in allowed_rpcs:
                        await route.continue_()
                        return
                    blocked_count += 1
                    blocked.append({"method": method, "path": path, "reason": "rpc_not_allowlisted"})
                    await route.abort()
                    return

                if method == "POST" and path == "/functions/v1/ai-tour-gptour":
                    if len(ai_calls) >= 4:
                        blocked_count += 1
                        blocked.append({"method": method, "path": path, "reason": "ai_budget_exceeded"})
                        await route.abort()
                        return

                    req_body = request.post_data or ""
                    try:
                        req_json = json.loads(req_body) if req_body else {}
                    except Exception:
                        req_json = {}

                    user_prompt = ""
                    messages = req_json.get("messages") if isinstance(req_json, dict) else []
                    if isinstance(messages, list):
                        user_msgs = [m for m in messages if isinstance(m, dict) and m.get("role") == "user"]
                        if user_msgs:
                            user_prompt = str(user_msgs[-1].get("content") or "")

                    record = {
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "status": None,
                        "ultimoUSERprompt": user_prompt[:280],
                        "agentInfo.agentId_matches_selected": False,
                        "effectiveAgentId_matches_selected": False,
                        "intentorderMinDays": (req_json.get("intent") or {}).get("orderMinDays") if isinstance(req_json, dict) else None,
                        "requireOrderHistory": (req_json.get("intent") or {}).get("requireOrderHistory"),
                        "requestedArea": (req_json.get("intent") or {}).get("requestedArea") if isinstance(req_json, dict) else None,
                        "nPool": req_json.get("count") if isinstance(req_json, dict) else None,
                        "nSelection": None,
                        "needsInfo": None,
                    }
                    req_agent_id = ((req_json.get("agentInfo") or {}).get("agentId") if isinstance(req_json, dict) else None)
                    record["agentInfo.agentId_matches_selected"] = bool(selected_agent_id and req_agent_id == selected_agent_id)

                    response = await route.fetch()
                    text = await response.text()
                    record["status"] = response.status
                    try:
                        res_json = json.loads(text)
                        effective_id = res_json.get("effectiveAgentId")
                        record["effectiveAgentId_matches_selected"] = bool(selected_agent_id and effective_id == selected_agent_id)
                        sel = res_json.get("selection")
                        if isinstance(sel, list):
                            record["nSelection"] = len(sel)
                        record["needsInfo"] = res_json.get("needsInfo")
                    except Exception:
                        pass

                    ai_calls.append(record)
                    if response.status == 429:
                        stop_for_quota = True
                    await route.fulfill(status=response.status, headers=response.headers, body=text)
                    return

                if path.startswith("/cdn-cgi/"):
                    await route.continue_()
                    return

                if method in {"POST", "PUT", "PATCH", "DELETE"}:
                    text_hint = f"{method} {path}"
                    if any(h.lower() in text_hint.lower() for h in blocked_mutation_hints):
                        blocked_count += 1
                        blocked.append({"method": method, "path": path, "reason": "explicit_mutation_blocked"})
                        await route.abort()
                        return
                    blocked_count += 1
                    blocked.append({"method": method, "path": path, "reason": "write_blocked_fail_closed"})
                    await route.abort()
                    return

                await route.continue_()
            finally:
                pending_requests = max(0, pending_requests - 1)

        await page.route("**/*", route_guard)

        await page.set_viewport_size({"width": 390, "height": 844})
        print("Step 1: Await initial login/privacy screen")
        await page.wait_for_function("() => document.querySelector('[data-testid=privacy-accept]') || document.querySelector('[data-testid=login-email]')", timeout=90000)

        try:
            if await page.locator('[data-testid="privacy-accept"]').is_visible(timeout=1200):
                print("Step 1b: Accept privacy gate")
                await page.get_by_test_id('privacy-read-checkbox').click()
                await page.get_by_test_id('privacy-terms-checkbox').click()
                await page.get_by_test_id('privacy-data-checkbox').click()
                await page.get_by_test_id('privacy-accept').click()
        except Exception as e:
            print(f"Privacy gate skipped: {e}")

        print("Step 2: Login admin")
        await page.wait_for_selector('[data-testid="login-email"]', timeout=15000)
        credentials = re.search(r'# Role: Admin\s*email:\s*(.+)\s*password:\s*(.+)', Path('/app/memory/test_credentials.md').read_text())
        if not credentials:
            raise RuntimeError('Credenziali amministratore assenti')
        await page.get_by_test_id('login-email').fill(credentials[1].strip())
        await page.get_by_test_id('login-password').fill(credentials[2].strip())
        await page.get_by_test_id('login-submit').click()
        await page.get_by_test_id('dashboard-refresh').wait_for(timeout=45000)

        print("Step 3: Open GPTour")
        await page.get_by_text('AI Tour', exact=True).first.click()
        await page.wait_for_selector('[data-testid="aitour-open-gptour"]', timeout=25000)
        await page.get_by_test_id('aitour-open-gptour').click()
        await page.wait_for_selector('[data-testid="gptour-title"]', timeout=20000)

        print("Step 4: Measure admin default pool load")
        t0 = time.time()
        await page.wait_for_selector('[data-testid="gptour-pool-count"]', timeout=120000)
        await page.wait_for_function(
            """() => {
            const el = document.querySelector('[data-testid="gptour-pool-count"]');
            return !!el && !/carico|loading/i.test(el.textContent || '');
            }""",
            timeout=120000,
        )
        load_timings["admin_default_pool_loaded_sec"] = round(time.time() - t0, 3)
        load_timings["admin_default_pool_text"] = await page.locator('[data-testid="gptour-pool-count"]').inner_text()

        print("Step 5: Select Igor from settings")
        await page.get_by_test_id('gptour-settings').click()
        await page.wait_for_selector('[data-testid="gptour-agent-search"]', timeout=15000)
        await page.fill('[data-testid="gptour-agent-search"]', 'igor cinquegrani')
        chip = page.get_by_test_id(f'gptour-agent-{selected_agent_id}')
        selected_agent_name = (await chip.inner_text()).strip()
        selected_testid = await chip.get_attribute("data-testid")
        if selected_testid and selected_testid.startswith("gptour-agent-"):
            selected_agent_id = selected_testid.replace("gptour-agent-", "", 1)
        await chip.click()
        await page.get_by_test_id('gptour-settings-close').click()

        t1 = time.time()
        await page.wait_for_function(
            """() => {
            const el = document.querySelector('[data-testid="gptour-pool-count"]');
            if (!el) return false;
            const tx = (el.textContent || '').toLowerCase();
            return tx.includes('igor') && !tx.includes('carico') && !tx.includes('loading');
            }""",
            timeout=120000,
        )
        load_timings["igor_pool_loaded_sec"] = round(time.time() - t1, 3)
        load_timings["igor_pool_text"] = await page.locator('[data-testid="gptour-pool-count"]').inner_text()

        print("Step 6: Choose existing base Casa/Sede")
        home_clicked = False
        if await page.locator('[data-testid="gptour-home"]').is_visible(timeout=1200):
            await page.click('[data-testid="gptour-home"]', force=True)
            home_clicked = True
        elif await page.locator('[data-testid="gptour-office"]').is_visible(timeout=1200):
            await page.click('[data-testid="gptour-office"]', force=True)
            home_clicked = True
        if not home_clicked:
            await page.click('[data-testid="gptour-settings"]', force=True)
            await page.wait_for_timeout(300)
            if await page.locator('[data-testid="gptour-home"]').is_visible(timeout=2000):
                await page.click('[data-testid="gptour-home"]', force=True)
            elif await page.locator('[data-testid="gptour-office"]').is_visible(timeout=2000):
                await page.click('[data-testid="gptour-office"]', force=True)
            await page.wait_for_timeout(250)
            if await page.locator('[data-testid="gptour-settings-close"]').is_visible(timeout=1500):
                await page.click('[data-testid="gptour-settings-close"]', force=True)
            else:
                await page.keyboard.press("Escape")
        await page.wait_for_timeout(600)

        print("Step 7: Turno 1 (brief + 30gg + comune verificato)")
        prompt1 = f"Tabaccherie di {verified_comune} che non comprano da 30 giorni. Per il prossimo lunedì, una sola giornata, massimo 5 tappe. Niente follow-up, nessuna modifica agli appuntamenti."
        turn_prompts.append(prompt1)
        await page.fill('[data-testid="gptour-message-input"]', prompt1)
        await page.get_by_test_id('gptour-send').click()
        await expect(page.get_by_test_id('gptour-purchase-filter')).to_contain_text('30 giorni', timeout=120000)
        await page.get_by_test_id('gptour-plan').wait_for(timeout=120000)
        await expect(page.get_by_test_id('gptour-message-input')).to_be_editable(timeout=120000)
        first_filter = await page.get_by_test_id('gptour-purchase-filter').inner_text()
        first_metrics = await page.get_by_test_id('gptour-plan-metrics').inner_text()
        print('PASS turno 1: filtro verificato e piano reale', first_metrics)
        await page.get_by_test_id('gptour-plan-metrics').scroll_into_view_if_needed()
        await page.screenshot(path='/app/test_reports/artifacts_iter67/igor_literal_plan.jpeg', quality=20, full_page=False)

        toast_text = ""
        try:
            if await page.locator('[data-testid="gptour-toast"]').is_visible(timeout=1500):
                toast_text = await page.locator('[data-testid="gptour-toast"]').inner_text()
        except Exception:
            toast_text = ""

        if "429" in toast_text.lower() or "credito" in toast_text.lower() or stop_for_quota:
            stop_for_quota = True
            print("Quota/429 reached during Turno 1, stopping additional AI")

        if not stop_for_quota and len(ai_calls) < 4:
            print("Step 8: Turno 2 (solo orario)")
            prompt2 = "Parti alle 09:00"
            turn_prompts.append(prompt2)
            await page.fill('[data-testid="gptour-message-input"]', prompt2)
            await page.get_by_test_id('gptour-send').click()
            await expect(page.get_by_test_id('gptour-plan-metrics')).to_contain_text('09:00', timeout=120000)
            await expect(page.get_by_test_id('gptour-message-input')).to_be_editable(timeout=120000)
            await expect(page.get_by_test_id('gptour-purchase-filter')).to_contain_text('30 giorni')

        purchase_filter_text = ""
        if await page.locator('[data-testid="gptour-purchase-filter"]').is_visible(timeout=4000):
            purchase_filter_text = await page.locator('[data-testid="gptour-purchase-filter"]').inner_text()

        plan_metrics = ""
        plan_times = ""
        if await page.locator('[data-testid="gptour-plan-metrics"]').is_visible(timeout=5000):
            plan_metrics = await page.locator('[data-testid="gptour-plan-metrics"]').inner_text()
            plan_times = await page.locator('[data-testid="gptour-plan-times"]').inner_text()

        stop_rows = []
        for i in range(0, 25):
            loc = page.locator(f'[data-testid="gptour-stop-{i}"]')
            if await loc.count() == 0:
                break
            if await loc.first.is_visible(timeout=500):
                txt = await loc.first.inner_text()
                row_text = ""
                try:
                    row_text = await loc.first.locator('..').inner_text()
                except Exception:
                    row_text = txt
                stop_rows.append({"index": i, "title": txt, "row": row_text})

        all_in_verified_comune = True
        for r in stop_rows:
            if verified_comune.lower() not in (r.get("row") or "").lower():
                all_in_verified_comune = False
                break
        assert stop_rows, 'Nessuna tappa visibile nel piano'
        assert all_in_verified_comune, 'Piano fuori dal comune verificato'
        assert purchase_filter_text and '30 giorni' in purchase_filter_text

        last_order_sample = ""
        try:
            lo = page.locator('[data-testid^="gptour-last-order-"]').first
            if await lo.is_visible(timeout=2000):
                last_order_sample = await lo.inner_text()
        except Exception:
            last_order_sample = ""
        ready_orders = await page.locator('[data-testid^="gptour-last-order-"][data-testid$="-date"]').all_text_contents()
        assert len(ready_orders) == len(stop_rows), 'Alcune tappe senza ultimo ordine verificato'
        assert all(int(re.search(r'\((\d+) giorni fa\)', text)[1]) >= 30 for text in ready_orders)
        assert all(call['agentInfo.agentId_matches_selected'] and call['effectiveAgentId_matches_selected'] for call in ai_calls)
        assert any(call['ultimoUSERprompt'] == 'Parti alle 09:00' and call['requireOrderHistory'] and call['intentorderMinDays'] == 30 for call in ai_calls)
        await page.get_by_test_id('gptour-plan-metrics').scroll_into_view_if_needed()
        await page.screenshot(path='/app/test_reports/artifacts_iter67/igor_literal_second_turn.jpeg', quality=20, full_page=False)
        print('PASS turno 2: filtro e comune persistenti, tutti gli ultimi ordini >=30 giorni')

        print("Step 9: Back and reopen GPTour without AI")
        ai_calls_before_reopen = len(ai_calls)
        await page.get_by_test_id('gptour-back').click()
        await page.get_by_test_id('aitour-open-gptour').click()
        await page.wait_for_selector('[data-testid="gptour-title"]', timeout=25000)

        reopen_t0 = time.time()
        await page.wait_for_selector('[data-testid="gptour-pool-count"]', timeout=120000)
        await page.wait_for_function(
            """() => {
            const el = document.querySelector('[data-testid="gptour-pool-count"]');
            return !!el && !/carico|loading/i.test(el.textContent || '');
            }""",
            timeout=120000,
        )
        load_timings["reopen_default_pool_loaded_sec"] = round(time.time() - reopen_t0, 3)
        load_timings["reopen_default_pool_text"] = await page.locator('[data-testid="gptour-pool-count"]').inner_text()

        await page.get_by_test_id('gptour-settings').click()
        await page.wait_for_selector('[data-testid="gptour-agent-search"]', timeout=10000)
        await page.fill('[data-testid="gptour-agent-search"]', 'igor cinquegrani')
        chip2 = page.get_by_test_id(f'gptour-agent-{selected_agent_id}')
        await chip2.click()
        await page.get_by_test_id('gptour-settings-close').click()

        reopen_t1 = time.time()
        await page.wait_for_function(
            """() => {
            const el = document.querySelector('[data-testid="gptour-pool-count"]');
            if (!el) return false;
            const tx = (el.textContent || '').toLowerCase();
            return tx.includes('igor') && !tx.includes('carico') && !tx.includes('loading');
            }""",
            timeout=120000,
        )
        load_timings["reopen_igor_pool_loaded_sec"] = round(time.time() - reopen_t1, 3)
        load_timings["reopen_igor_pool_text"] = await page.locator('[data-testid="gptour-pool-count"]').inner_text()
        ai_calls_after_reopen = len(ai_calls)

        await expect(page.get_by_test_id('gptour-purchase-filter')).to_contain_text('30 giorni')
        assert ai_calls_after_reopen == ai_calls_before_reopen
        await page.screenshot(path="/app/test_reports/artifacts_iter67/igor_literal_reopen.jpeg", quality=20, full_page=False)

        error_text = await page.evaluate("""() => {
        const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));
        return errorElements.map(el => el.textContent).join(", ");
        }""")
        if error_text:
            print(f"Found error message: {error_text}")
        else:
            print("No error messages found on the page")

        artifact = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "selected_agent": {
                "id": selected_agent_id,
                "name": selected_agent_name,
                "selector_testid": selected_testid,
            },
            "verified_comune": verified_comune,
            "turn_prompts": turn_prompts,
            "edge_calls": ai_calls,
            "edge_calls_count": len(ai_calls),
            "ai_calls_before_reopen": ai_calls_before_reopen,
            "ai_calls_after_reopen": ai_calls_after_reopen,
            "blocked": {
                "count": blocked_count,
                "items": blocked[:80],
                "crm_writes_forwarded": forwarded_writes,
            },
            "load_timings": load_timings,
            "network_state": {
                "pending_requests_at_end": pending_requests,
            },
            "ui_checks": {
                "first_filter": first_filter,
                "first_metrics": first_metrics,
                "ready_last_orders": ready_orders,
                "reopen_purchase_filter_restored": True,
                "purchase_filter_text": purchase_filter_text,
                "plan_metrics": plan_metrics,
                "plan_times": plan_times,
                "stop_count": len(stop_rows),
                "all_stops_in_verified_comune": all_in_verified_comune,
                "last_order_sample": last_order_sample,
            },
            "stop_due_to_quota_429": stop_for_quota,
        }

        with open(artifact_path, "w", encoding="utf-8") as f:
            json.dump(artifact, f, ensure_ascii=False, indent=2)
        print(f"Artifact saved: {artifact_path}")

    except Exception as e:
        run_error = str(e)
        print(f"E2E error: {run_error}")
        await page.screenshot(path="/app/test_reports/artifacts_iter67/igor_literal_error.jpeg", quality=20, full_page=False)
        raise
    finally:
        if not os.path.exists(artifact_path):
            fallback = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "selected_agent": {"id": selected_agent_id, "name": selected_agent_name, "selector_testid": selected_testid},
                "verified_comune": verified_comune,
                "turn_prompts": turn_prompts,
                "edge_calls": ai_calls,
                "edge_calls_count": len(ai_calls),
                "blocked": {"count": blocked_count, "items": blocked[:80], "crm_writes_forwarded": forwarded_writes},
                "load_timings": load_timings,
                "network_state": {"pending_requests_at_end": pending_requests},
                "error": run_error,
                "stop_due_to_quota_429": stop_for_quota,
            }
            with open(artifact_path, "w", encoding="utf-8") as f:
                json.dump(fallback, f, ensure_ascii=False, indent=2)
            print(f"Fallback artifact saved: {artifact_path}")
