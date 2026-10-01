# Diagnostica: proposta fill accettata e successiva validazione iniziale

> **RISOLTO dopo approvazione esplicita:** contratto opzionale `gptourContext.acceptedFillKeys`, controllo per key in ricalcolo/persistenza/ripristino, senza allargare Intent o corridor. Verificati33nuovitest e flusso browser isolato Accetta→riordina→riapri→salva; rapporto `gptour_accepted_fill_36fdcc7f.md`. Il testo sotto conserva la diagnosi storica, non lo stato attuale.

Confermato dal testing indipendente iteration53 con fixture, senza rete o scritture CRM.

Input:
- Intent: requestedEntityTypes=['orphan'], ownOrphansOnly=true, allowedExpansionTypes=[].
- Pool: un proprio orfano e un prospect senza contatto noto (dato verificato).
- Risultato con selection=[own, prospect], come dopo accettazione della proposta.

Risultati osservati:
1. candidateMatchesTourIntent(prospect, intent, 'fill') è true con la patch richiesta.
2. La proposta può quindi mostrare il prospect.
3. useGptour.acceptProposal chiama rebuild mantenendo l'Intent invariato.
4. prepareGptDays valida selection con modalità initial e mantiene solo own.
5. Warning: prospect escluso per «tipologia non autorizzata».
6. assertGptourPlan usa anch'esso initial: una semplice deroga nel planner non basterebbe alla persistenza.

La riproduzione temporanea dell'agente verificava che il bug fosse presente, non il comportamento desiderato. È stata rimossa dalla suite di regressione per non consolidare il bug come aspettativa corretta. La sua evidenza resta in iteration53 e in questo documento. La suite richiesta conta 217 test, non include questa diagnosi.

Nessuna patch a hook/planner/Intent/contesto/Live: il perimetro richiesto li esclude salvo necessità diretta. La soluzione richiede consenso su come registrare l'accettazione:
- preferibile: autorizzazione alle sole key accettate, senza ampliare genericamente corridor o criteri iniziali;
- alternativa: ampliare allowedExpansionTypes per tipologia, ma cambierebbe il significato del criterio anche per corridor e turni successivi.

Non applicata nessuna delle due opzioni. Chiedere approvazione della soluzione puntuale prima di implementarla. La correzione del predicate e la generazione delle proposte sono verificate; il percorso completo di accettazione di tipi nuovi NON è risolto da questa patch isolata.