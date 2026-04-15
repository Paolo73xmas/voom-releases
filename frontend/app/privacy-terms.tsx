import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PRIVACY_ACCEPTED_KEY = '@privacy_terms_accepted';
const PRIVACY_ACCEPTED_DATE_KEY = '@privacy_terms_accepted_date';

// Full legal text
const PARTE_I = `PARTE I – INFORMATIVA PRIVACY

1. Titolare del trattamento
Il titolare del trattamento dei dati personali è Jivea s.r.l., con sede in Via Giuseppe di Vittorio, 54, 20073 Opera (MI), Italy, P. IVA e C.F. 13137830967, contattabile all'indirizzo e-mail info@jivea.eu. Eventuali comunicazioni relative alla privacy possono essere indirizzate al medesimo recapito.

2. Categorie di dati trattati
Nell'ambito dell'erogazione del CRM possono essere trattati, nei limiti di quanto necessario, le seguenti categorie di dati personali:
• dati identificativi e di contatto dell'utente, quali nome, cognome, ragione sociale, ruolo aziendale, e-mail, numero di telefono e credenziali di accesso;
• dati tecnici e di utilizzo, quali indirizzo IP, log di accesso, data e ora delle sessioni, dispositivo/browser, identificativi tecnici, preferenze di configurazione e dati necessari alla sicurezza del sistema;
• dati operativi caricati o gestiti nel CRM dall'utente o dall'organizzazione di appartenenza, quali anagrafiche clienti, note, attività, ticket, appuntamenti, documenti e ulteriori informazioni inserite nel sistema;
• eventuali dati amministrativi e di audit necessari alla gestione degli account, all'assistenza tecnica, alla prevenzione di abusi e alla tutela dei diritti del titolare.

L'utente si impegna a non inserire nel CRM dati eccedenti, non pertinenti o appartenenti a categorie particolari di dati personali, salvo che ciò sia strettamente necessario, lecito e adeguatamente autorizzato dalla propria organizzazione.

3. Finalità del trattamento e basi giuridiche
I dati personali sono trattati per le seguenti finalità:
• registrazione, autenticazione, gestione dell'account e abilitazione all'utilizzo del CRM;
• erogazione delle funzionalità del servizio, assistenza tecnica, manutenzione correttiva ed evolutiva;
• sicurezza informatica, prevenzione di accessi abusivi, frodi, uso illecito o non conforme della piattaforma;
• adempimento di obblighi di legge, regolamentari, fiscali, amministrativi o di richieste provenienti da autorità competenti;
• eventuale invio di comunicazioni di servizio strettamente connesse al funzionamento, alla sicurezza o agli aggiornamenti del CRM;
• accertamento, esercizio o difesa di un diritto del titolare in sede giudiziaria o stragiudiziale.

Le basi giuridiche del trattamento sono, a seconda dei casi, l'esecuzione di misure precontrattuali o di un contratto relativo all'uso del servizio, l'adempimento di obblighi legali, il legittimo interesse del titolare alla sicurezza e corretta gestione della piattaforma e, solo ove necessario, il consenso dell'interessato.

4. Natura del conferimento dei dati
Il conferimento dei dati contrassegnati come necessari o obbligatori è indispensabile per la creazione e la gestione dell'account e per l'utilizzo del CRM. L'eventuale mancato conferimento può comportare l'impossibilità di registrarsi, accedere o utilizzare in tutto o in parte il servizio. I dati eventualmente richiesti sulla base del consenso sono facoltativi e il mancato rilascio non pregiudica l'uso ordinario del CRM, salvo che la specifica funzione dipenda da tale consenso.

5. Modalità del trattamento e misure di sicurezza
Il trattamento è effettuato con strumenti informatici e telematici, secondo principi di liceità, correttezza, trasparenza, minimizzazione, esattezza, limitazione della conservazione e integrità. Il titolare adotta misure tecniche e organizzative ragionevoli e proporzionate per proteggere i dati personali da accessi non autorizzati, perdita, distruzione, alterazione, divulgazione indebita o uso illecito, tra cui – ove applicabili – sistemi di autenticazione, profilazione degli accessi, segregazione dei ruoli, cifratura, backup, logging, controllo delle autorizzazioni e procedure interne di gestione degli incidenti.

6. Conservazione dei dati
I dati personali sono conservati per il tempo strettamente necessario al perseguimento delle finalità sopra indicate e, in particolare:
• dati di account: per tutta la durata dell'abilitazione dell'utente e, successivamente, per il periodo necessario alla gestione di richieste, contestazioni, backup, obblighi di legge e tutela del titolare;
• log e dati tecnici di sicurezza: per un periodo proporzionato alle esigenze di sicurezza, audit, prevenzione abusi e difesa dei diritti;
• dati soggetti a obblighi di legge: per il tempo previsto dalla normativa applicabile;
• dati trattati sulla base del consenso: fino a revoca del consenso, salvo ulteriore conservazione ove necessaria per obblighi di legge o difesa del titolare.

7. Destinatari dei dati
I dati possono essere conosciuti e trattati, nei limiti delle rispettive competenze, da personale autorizzato del titolare e da soggetti terzi che forniscono servizi strumentali all'erogazione del CRM, quali fornitori IT, hosting/cloud provider, manutentori, consulenti, soggetti che erogano assistenza tecnica, sicurezza, backup, monitoraggio o supporto amministrativo. Tali soggetti operano, ove richiesto dalla legge, in qualità di responsabili del trattamento o di autonomi titolari.
I dati non sono diffusi. In assenza di specifica previsione, il servizio non effettua attività pubblicitarie, di profilazione commerciale o di rivendita dei dati personali.

8. Trasferimento dei dati fuori dallo SEE
Qualora, per esigenze tecniche o organizzative, si renda necessario trasferire dati personali verso Paesi non appartenenti allo Spazio Economico Europeo, tale trasferimento avverrà nel rispetto della normativa applicabile e mediante adozione delle garanzie previste dalla legge, quali decisioni di adeguatezza, clausole contrattuali standard o ulteriori misure supplementari ove necessarie.

9. Diritti degli interessati
L'interessato può esercitare, nei casi previsti dalla normativa, i diritti di accesso, rettifica, cancellazione, limitazione del trattamento, portabilità dei dati, opposizione al trattamento e revoca del consenso eventualmente prestato, fermo restando che la revoca non pregiudica la liceità del trattamento svolto prima della revoca.
L'interessato ha inoltre il diritto di proporre reclamo all'autorità di controllo competente.
Le richieste possono essere inviate ai recapiti del titolare indicati nel presente documento. Il titolare risponde nei termini previsti dalla normativa applicabile, previa eventuale verifica dell'identità del richiedente.

10. Dati inseriti dall'utente nel CRM
Qualora l'utente o l'organizzazione di appartenenza utilizzino il CRM per inserire, importare o gestire dati personali di clienti, contatti, dipendenti o terzi, l'utente dichiara e garantisce di avere un'idonea base giuridica per tale trattamento e di agire nel rispetto della normativa applicabile. Il titolare del CRM non risponde dei contenuti caricati dall'utente in violazione di legge, restando ferma la facoltà di sospendere o limitare l'account in caso di uso illecito o non conforme.

11. Aggiornamenti dell'informativa
Il titolare si riserva di aggiornare o modificare la presente informativa in qualsiasi momento, anche in conseguenza di modifiche normative, organizzative o tecniche. Le versioni aggiornate saranno rese disponibili tramite il CRM o con altri mezzi idonei. Ove richiesto dalla legge, sarà richiesto un nuovo consenso o una nuova presa visione.`;

const PARTE_II = `PARTE II – TERMINI E CONDIZIONI DI UTILIZZO

12. Oggetto del servizio
Il CRM "CRM Jivea" è una piattaforma software resa disponibile gratuitamente agli utenti autorizzati dal titolare o dall'organizzazione cliente/partner. Il servizio non prevede acquisti in-app, non ospita pubblicità e viene fornito con le funzionalità, caratteristiche e limitazioni tecniche di volta in volta disponibili.

13. Requisiti di accesso e account
L'accesso al CRM è consentito esclusivamente a utenti autorizzati. L'utente è tenuto a fornire dati veritieri, completi e aggiornati, a custodire con diligenza le proprie credenziali e a non consentire l'utilizzo dell'account a soggetti non autorizzati. L'utente è responsabile di ogni attività compiuta tramite il proprio account, salvo che provi l'uso abusivo da parte di terzi non imputabile a propria negligenza.

14. Uso consentito e divieti
L'utente si impegna a utilizzare il CRM in modo lecito, corretto e conforme alla sua destinazione d'uso. In particolare, è vietato:
• utilizzare il servizio per finalità illecite, fraudolente, diffamatorie o lesive di diritti altrui;
• caricare malware, codice dannoso, script ostili o contenuti idonei a compromettere il funzionamento del sistema;
• tentare di aggirare le misure di sicurezza, effettuare accessi non autorizzati, attività di scraping massivo o reverse engineering salvo quanto inderogabilmente consentito dalla legge;
• inserire dati personali non pertinenti, eccedenti o trattati in assenza di idonea base giuridica;
• cedere, sublicenziare, rivendere o sfruttare commercialmente il CRM, salvo preventiva autorizzazione scritta del titolare.

15. Disponibilità del servizio
Il titolare si impegna a mantenere il CRM ragionevolmente disponibile, ma non garantisce l'assenza di interruzioni, ritardi, errori, vulnerabilità o incompatibilità tecniche. Il servizio può essere sospeso o limitato, anche senza preavviso, per esigenze di manutenzione, aggiornamento, sicurezza, adeguamento normativo, indisponibilità di infrastrutture di terzi o altre cause tecniche e organizzative.

16. Assenza di corrispettivo
L'utente prende atto che il CRM è reso disponibile a titolo gratuito. L'assenza di un corrispettivo economico incide sull'allocazione del rischio contrattuale e sui limiti di responsabilità di seguito previsti, fatti salvi i casi inderogabili di dolo, colpa grave o ulteriori ipotesi non limitabili per legge.

17. Proprietà intellettuale
Tutti i diritti di proprietà intellettuale e industriale relativi al CRM, ai suoi contenuti, al software, alle interfacce, ai layout, alle banche dati, ai segni distintivi e alla documentazione restano nella titolarità esclusiva del titolare o dei rispettivi licenzianti. L'utente ottiene unicamente un diritto personale, non esclusivo, non cedibile e revocabile di utilizzo del servizio nei limiti consentiti dal presente documento.

18. Sospensione e cessazione dell'accesso
Il titolare può sospendere, limitare o revocare l'accesso al CRM, anche con effetto immediato, in caso di violazione dei presenti termini, uso illecito del servizio, rischio per la sicurezza, ordine dell'autorità, cessazione del progetto o dell'organizzazione di riferimento, inattività prolungata dell'account oppure per altre ragioni organizzative o tecniche adeguatamente motivate. Ove ragionevolmente possibile, l'utente sarà informato preventivamente o senza ritardo.

19. Limitazione di responsabilità
Nei limiti massimi consentiti dalla legge, il CRM è fornito "così com'è" e "come disponibile". Il titolare non assume garanzie specifiche di continuità, idoneità per finalità particolari, assenza di errori o risultati economici/commerciali derivanti dall'uso del servizio. Il titolare non risponde di danni indiretti, perdita di profitto, perdita di chance, perdita di dati imputabile a comportamento dell'utente, mancati guadagni, interruzione dell'attività o danni derivanti da infrastrutture, software o servizi di terzi, salvo i casi di dolo o colpa grave e quanto diversamente imposto da norme inderogabili.

20. Manleva
L'utente si impegna a tenere indenne e manlevare il titolare da contestazioni, pretese, danni, costi o spese derivanti dall'uso illecito del CRM, dal caricamento di contenuti non autorizzati, dalla violazione dei diritti di terzi o dall'inosservanza degli obblighi previsti dal presente documento, salvo che ciò dipenda da fatto esclusivo del titolare.

21. Legge applicabile e foro competente
I presenti termini sono regolati dalla legge italiana, salvo l'eventuale applicazione di norme inderogabili diverse. Per ogni controversia relativa all'interpretazione, validità, efficacia o esecuzione del presente documento è competente in via esclusiva il Foro di Milano, salvo diverso foro inderogabile previsto dalla legge.

22. Clausole finali
L'eventuale nullità o inefficacia di una o più clausole non comporta l'invalidità delle restanti disposizioni, che rimarranno pienamente efficaci. Il mancato esercizio di un diritto da parte del titolare non costituisce rinuncia. I titoli degli articoli hanno mera funzione espositiva e non incidono sull'interpretazione del documento.

23. Monitoraggio della posizione GPS
L'utente prende atto e acconsente espressamente che Jivea S.r.l., in qualità di titolare del trattamento, potrà raccogliere, registrare e trattare i dati di geolocalizzazione (posizione GPS) del dispositivo mobile dell'utente durante il periodo in cui l'applicazione è attiva (in primo piano) sul dispositivo stesso.
Tale trattamento è finalizzato a:
• ottimizzare l'organizzazione dell'attività commerciale e la gestione delle visite ai punti vendita;
• verificare la corretta esecuzione delle attività sul territorio;
• migliorare la qualità del servizio e la pianificazione operativa.
I dati di geolocalizzazione saranno trattati nel rispetto della normativa vigente in materia di protezione dei dati personali (Regolamento UE 2016/679 – GDPR e D.Lgs. 196/2003 e ss.mm.ii.) e conservati per il periodo strettamente necessario al perseguimento delle finalità sopra indicate, salvo diversi obblighi di legge.
L'utente potrà in qualsiasi momento revocare il consenso alla geolocalizzazione disattivando i permessi di localizzazione dalle impostazioni del proprio dispositivo; tale revoca non pregiudica la liceità del trattamento effettuato prima della revoca, ma potrebbe limitare alcune funzionalità dell'applicazione.`;

export default function PrivacyTermsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const readOnly = params.readOnly === 'true';

  const [check1, setCheck1] = useState(false);
  const [check2, setCheck2] = useState(false);
  const [check3, setCheck3] = useState(false);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);

  const allChecked = check1 && check2 && check3;

  const handleAccept = async () => {
    if (!allChecked) return;
    const now = new Date().toISOString();
    await AsyncStorage.setItem(PRIVACY_ACCEPTED_KEY, 'true');
    await AsyncStorage.setItem(PRIVACY_ACCEPTED_DATE_KEY, now);
    router.replace('/login');
  };

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isEnd = layoutMeasurement.height + contentOffset.y >= contentSize.height - 60;
    if (isEnd && !scrolledToEnd) {
      setScrolledToEnd(true);
    }
  };

  const CheckboxRow = ({ checked, onPress, label }: { checked: boolean; onPress: () => void; label: string }) => (
    <TouchableOpacity 
      style={styles.checkboxRow} 
      onPress={onPress} 
      activeOpacity={0.7}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
      </View>
      <Text style={styles.checkboxLabel}>{label}</Text>
    </TouchableOpacity>
  );

  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top }]}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          {readOnly && (
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          )}
          <View style={styles.headerContent}>
            <Ionicons name="shield-checkmark" size={28} color="#FFFFFF" />
            <Text style={styles.headerTitle}>Informativa Privacy{'\n'}e Termini di Utilizzo</Text>
          </View>
          <Text style={styles.headerSubtitle}>
            CRM Jivea — Jivea s.r.l.
          </Text>
          <Text style={styles.headerVersion}>Versione: 12/04/2026</Text>
        </View>

        {/* Scrollable Legal Text */}
        <ScrollView 
          style={styles.textContainer} 
          contentContainerStyle={styles.textContent}
          onScroll={handleScroll}
          scrollEventThrottle={200}
          showsVerticalScrollIndicator={true}
        >
          <Text style={styles.introText}>
            Il presente documento disciplina, in un testo unico, l'informativa sul trattamento dei dati personali degli utenti del sistema CRM e i termini e le condizioni che regolano l'accesso e l'utilizzo del servizio.
          </Text>

          <View style={styles.separator} />

          <Text style={styles.partTitle}>PARTE I</Text>
          <Text style={styles.partSubtitle}>INFORMATIVA PRIVACY</Text>
          <Text style={styles.legalText}>{PARTE_I.replace('PARTE I – INFORMATIVA PRIVACY\n\n', '')}</Text>

          <View style={styles.separator} />

          <Text style={styles.partTitle}>PARTE II</Text>
          <Text style={styles.partSubtitle}>TERMINI E CONDIZIONI DI UTILIZZO</Text>
          <Text style={styles.legalText}>{PARTE_II.replace('PARTE II – TERMINI E CONDIZIONI DI UTILIZZO\n\n', '')}</Text>

          <View style={{ height: 24 }} />
        </ScrollView>

        {/* Acceptance section (only in acceptance mode) */}
        {!readOnly && (
          <View style={styles.acceptanceSection}>
            {!scrolledToEnd && (
              <View style={styles.scrollHint}>
                <Ionicons name="arrow-down" size={16} color="#6B7280" />
                <Text style={styles.scrollHintText}>Scorri per leggere tutto il documento</Text>
              </View>
            )}

            <CheckboxRow
              checked={check1}
              onPress={() => setCheck1(!check1)}
              label={'Dichiaro di aver letto e compreso l\'Informativa Privacy relativa al CRM "CRM Jivea".'}
            />
            <CheckboxRow
              checked={check2}
              onPress={() => setCheck2(!check2)}
              label={'Dichiaro di aver letto, compreso e accettato i Termini e le Condizioni di utilizzo del CRM "CRM Jivea".'}
            />
            <CheckboxRow
              checked={check3}
              onPress={() => setCheck3(!check3)}
              label={'Dichiaro di comprendere che il conferimento dei dati necessari è indispensabile per l\'accesso e l\'utilizzo del CRM.'}
            />

            <TouchableOpacity
              style={[styles.acceptButton, !allChecked && styles.acceptButtonDisabled]}
              onPress={handleAccept}
              disabled={!allChecked}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.acceptButtonText}>Accetta e Continua</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Read-only footer */}
        {readOnly && (
          <View style={styles.readOnlyFooter}>
            <TouchableOpacity 
              style={styles.readOnlyButton} 
              onPress={() => router.back()}
            >
              <Text style={styles.readOnlyButtonText}>Chiudi</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1E40AF',
  },
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    backgroundColor: '#1E40AF',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  backButton: {
    marginBottom: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 26,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#93C5FD',
    marginTop: 4,
  },
  headerVersion: {
    fontSize: 12,
    color: '#93C5FD',
    marginTop: 2,
    opacity: 0.8,
  },
  textContainer: {
    flex: 1,
  },
  textContent: {
    padding: 20,
  },
  introText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  separator: {
    height: 1,
    backgroundColor: '#D1D5DB',
    marginVertical: 20,
  },
  partTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E40AF',
    marginBottom: 2,
    letterSpacing: 1,
  },
  partSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  legalText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 21,
  },
  acceptanceSection: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 : 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 8,
      },
      default: {
        boxShadow: '0 -3px 8px rgba(0,0,0,0.1)',
      },
    }),
  },
  scrollHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 6,
  },
  scrollHintText: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
    minHeight: 44,
    paddingVertical: 4,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    backgroundColor: '#FFFFFF',
  },
  checkboxChecked: {
    backgroundColor: '#1E40AF',
    borderColor: '#1E40AF',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
  },
  acceptButton: {
    flexDirection: 'row',
    backgroundColor: '#1E40AF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  acceptButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  readOnlyFooter: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 32 : 20,
  },
  readOnlyButton: {
    backgroundColor: '#1E40AF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readOnlyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
