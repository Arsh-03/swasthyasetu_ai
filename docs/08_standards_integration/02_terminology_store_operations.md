# Terminology Store: Setup and Operations

**Document ID:** STD-TERMINOLOGY-OPS-2026-V1
**Audience:** Whoever installs CareBridge or updates a clinical terminology release
**Related:** [01_integration_plan.md](01_integration_plan.md)

---

## 1. What it is

All official clinical vocabularies live in one local SQLite file:

```
backend/data/terminology.db      (git-ignored; built on each machine with the commands below)
```

- The app only **reads** it. Imports are an admin step run from the command line.
- It has **no network access**: releases are downloaded once and imported offline.
- Changes take effect on the next lookup. **No backend restart is needed.**
- If the file is missing, the notepad keeps working from its built-in starter vocabulary, just without official codes.

Run every command from the `backend/` folder. Official release **zips can be passed directly**; only the needed files are extracted, to a temporary folder that is deleted afterwards.

```bash
python -m app.terminology status          # what is imported, versions, counts, size
python -m app.terminology --help
```

## 2. Importing each standard

### ICD-11 + ICD-10 + maps (WHO): free, no account
Download from the [ICD-11 browser](https://icd.who.int/browse/latest-release/mms/en) → release files:
`SimpleTabulation-ICD-11-MMS-en.zip` and `mapping.zip`.

```bash
python -m app.terminology icd --tabulation SimpleTabulation-ICD-11-MMS-en.zip \
    --map-10to11 mapping.zip --map-11to10 mapping.zip
```
- **Kept:** every ICD-11 category with a code. The WHO ICD-10 categories (titles taken from the mapping table). Maps in both directions.
- **Skipped:** chapters and blocks without codes; extension codes (X), functioning (V) and traditional-medicine patterns (26); map rows that point to code ranges ("J09-J18") or chapter numbers.
- Licence: WHO ICD-11, CC BY-ND 3.0 IGO. Show WHO attribution in the app's About page.

### RxNorm prescribable content (NLM): free, no account
Download `RxNorm_full_prescribe_MMDDYYYY.zip` from the [RxNorm files page](https://www.nlm.nih.gov/research/umls/rxnorm/docs/rxnormfiles.html).

```bash
python -m app.terminology rxnorm RxNorm_full_prescribe_10052026.zip --version 2026-10-05
```
- **Kept:** ingredients (IN, PIN, MIN) and clinical drugs (SCD), with their prescribable names and synonyms.
- **Skipped:** US brand names (BN, SBD), suppressed and obsolete names.
- **Indian names added as aliases** (paracetamol for acetaminophen, salbutamol for albuterol, frusemide, glibenclamide, lignocaine, rifampicin, …). The list is `INDIAN_DRUG_NAMES` in `backend/app/terminology/importers.py`.

### SNOMED CT: needs organisation registration
India is a SNOMED CT member country; NRCeS is the national release centre. Register as an affiliate (NRCeS / SNOMED MLDS), then download the RF2 release zip (India edition or International edition).

```bash
python -m app.terminology snomed SnomedCT_InternationalRF2_PRODUCTION_20260131.zip
python -m app.terminology snomed <zip> --all-hierarchies     # include every hierarchy (larger)
```
- Reads the RF2 **Snapshot** files: concepts, English descriptions and the English language refset (GB preferred terms first, as India follows GB English).
- **Kept by default:** active concepts in clinical hierarchies: disorder, finding, procedure, body structure, substance, product, observable entity, situation, organism, morphologic abnormality, event.
- **Skipped:** inactive concepts and descriptions; qualifier values and other non-clinical hierarchies (unless `--all-hierarchies`). FSNs are used only for the hierarchy tag, not as searchable text.

### LOINC: needs a free loinc.org account
Download the LOINC table release (`Loinc_2.xx.zip`) from [loinc.org/downloads](https://loinc.org/downloads/).

```bash
python -m app.terminology loinc Loinc_2.81.zip --version 2.81
python -m app.terminology loinc Loinc_2.81.zip --version 2.81 --all-classes   # also claims & surveys
```
- **Kept:** ACTIVE codes of class type 1 (laboratory, category `lab`) and 2 (clinical, e.g. vital signs, category `observation`). Searchable by long common name, display name, consumer name and short name.
- **Skipped:** deprecated/discouraged codes; claims attachments and surveys (unless `--all-classes`).

### CDCI (Indian medicines, NRCeS) or any other catalogue: CSV
Request the CDCI release from [NRCeS national releases](https://www.nrces.in/services/national-releases). Save it as CSV if it comes as a spreadsheet. Then tell the importer which columns to use:

```bash
python -m app.terminology csv cdci.csv --system CDCI \
    --code-col "CDCI Code" --name-col "Generic Name" --synonym-cols "Brand Name" \
    --category drug --version 2026-01 --licence "NRCeS CDCI"
```
Column names must match the file's header exactly; the importer lists the available columns if one is wrong.

### DDInter 2.0 drug–drug interactions: free for non-commercial use
Download the 8 files `ddinter_downloads_code_A.csv … _V.csv` from the [DDInter download page](https://ddinter2.scbdd.com/download/) into one folder.

```bash
python -m app.terminology ddinter path/to/ddinter_folder --version 2.0
```
- **Kept:** 1,939 drugs and 160,235 distinct interacting pairs, graded Major / Moderate / Minor / Unknown (the same pair appears in several class files; it is stored once).
- **Licence: CC BY-NC-SA 4.0.** Non-commercial only (fine for this academic hackathon). Credit DDInter wherever alerts are shown (the notepad does). A commercial product must switch to a commercial source (DrugBank commercial or NRCeS DISB) via the same `interactions` table.
- DDInter downloads contain the severity level but not drug-specific advice, so alerts show general guidance per level.

### English word lists for spell-check: free
Downloaded and imported automatically by `python scripts/fetch_open_datasets.py --only english` (also part of `start.ps1 -SetupData`):
- `en_50k.txt`: the 50,000 most common English words with frequencies ([FrequencyWords](https://github.com/hermitdave/FrequencyWords), CC BY-SA 4.0; credit Hermit Dave / OpenSubtitles). Used to pick the most likely correction.
- `words_alpha.txt`: 370,000 valid English words ([dwyl/english-words](https://github.com/dwyl/english-words), public domain). Used so rare but real words aren't flagged.

The spell-checker never flags a word found in any of: these lists, the medical vocabularies, medicine names and brands, a list of clinical abbreviations (cbc, ecg, sos, bd…), or ALL-CAPS acronyms. It **auto-corrects** only clear-cut typos (one slip, 4+ letters, one obvious best candidate). Other likely typos are offered for review. Doctors can switch auto-correct off with the "Auto-correct & punctuate" toggle, and Ctrl+Z undoes any automatic change without it being re-applied.

### Removing a system
```bash
python -m app.terminology remove LOINC
```

## 3. Updating to a new release

Run the same import command with the new file. Each import **replaces** that system's previous data inside one transaction, so a failed import leaves the old data untouched. The backend uses the new data from the next lookup.

## 4. Measured on the development laptop

Intel i5-10310U, 8 GB RAM, no GPU (2026-10-21):

| Dataset | Concepts | Searchable names | Import time |
|---|---|---|---|
| ICD-11 MMS 2026-01 | 17,255 | 17,255 | ~2 s (with ICD-10 and maps) |
| ICD-10 (WHO) + maps | 11,243 | 11,243; 12,221 + 14,834 map rows | (included above) |
| RxNorm prescribable 2026-10-05 | 20,870 | 41,381 | ~2 s |
| **Total today** | **49,368** | — | **22 MB** database |

**SNOMED CT-scale load test** (synthetic RF2 release with the same structure: 350,000 concepts, 1.22 million descriptions):

| Measure | Result |
|---|---|
| Import time | 28 s |
| Peak memory during import | 257 MB |
| Database size | 146 MB (real SNOMED wording is longer: expect roughly 250–400 MB) |
| Search latency (60 notepad-style queries) | median 4.6 ms, 95th percentile 13 ms, worst 43 ms |
| Extra memory used by the running backend for searching | ~10 MB |

The backend can carry every listed standard on a modest server, and on a low-end development machine, without extra services.

## 5. How search behaves

- **Two stages:** names that **start with** what the doctor typed first; then names that contain all the typed words, only if the first stage found little. This keeps broad prefixes such as "pn" or "acute" fast even on SNOMED-sized data.
- **Ranking:** starts-with match, preferred term, the note section's likely category (Plan → medicines, Investigations → labs, History/Assessment → disorders), shorter and broader terms first, SNOMED CT slightly ahead for clinical wording, and ICD pregnancy/perinatal codes only when the words mention pregnancy or newborns.
- **Section rules:** medicines are not suggested in Assessment or Investigations.
- **Codes attached on accept:** the result's own code, plus the matching ICD-10 for an ICD-11 result (WHO map). The FHIR export adds the counterpart ICD code for every coded diagnosis and exports medicines as `MedicationRequest` (draft).
- **Spell-check** uses the full imported vocabulary. A word found anywhere in the official data is never "corrected".

## 6. Medication safety checks

`backend/app/services/safety_engine.py` runs on every notepad analysis (and on `POST /api/v1/cdss/validate`):

1. **Finds medicines in the note:** DDInter generic names, Indian/INN names (paracetamol, aspirin, aluminium, frusemide…) and a starter list of common Indian brands (Augmentin, Ecosprin, Gelusil, Ciplox, Glycomet, Pan 40…). A medicine right after "stopped", "no", "avoid", "allergic to" etc. on the same line is ignored.
2. **Interactions** between medicines in the note, and between note medicines and the patient's current medications (encounter + ABHA medical history). Source: DDInter. The 4 older curated rules in `ddi_engine.py` fill only pairs DDInter doesn't cover.
3. **Allergies** from the patient record, by drug class: penicillins, cephalosporin cross-reactivity (caution), sulfonamides, NSAIDs, fluoroquinolones, macrolides, tetracyclines, or the exact drug name.

Severity order: contraindicated → major → moderate → caution; minor and ungraded pairs are grouped as lower priority. Each alert shows its source. Alerts never change the note; the doctor decides.

**Needs clinical review before real use:** the brand list, name equivalents and allergy classes are starter content in `safety_engine.py`. CDCI replaces the brand list once imported.

## 7. API

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/terminology/status` | Imported systems, versions, counts (doctor login) |
| `GET /api/v1/terminology/search?q=chest%20p&section=complaints` | Same search the notepad uses (fallback when the WebSocket is down) |
| WebSocket `TERM_SEARCH` / `TERM_RESULTS` | Live notepad search (see `routers/intellisense.py`) |

## 8. Troubleshooting

| Symptom | Check |
|---|---|
| Notepad shows only starter suggestions, no codes | `python -m app.terminology status`: is the database present and populated? |
| `not found:` on import | Path to the downloaded file is wrong |
| `no file matching ... inside the zip` | Wrong zip for that command (e.g. the ICD print zip instead of SimpleTabulation) |
| `Columns not found` (CSV import) | Use the exact header names the error lists |
| Disk space | Imports need the zip plus roughly 2× the final database size free while running |
| Safety panel says "curated rules only" | DDInter isn't imported: run the `ddinter` import |
