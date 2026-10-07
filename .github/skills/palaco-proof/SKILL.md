1| ---
2| name: palaco-proof
3| description: "PALACO PROOF is the shared proof layer for every PALACO agent. Use to verify claims, decisions, changes, outputs, authority, evidence, provenance, validation, replayability, and unres[...]
4| argument-hint: "Geef `ON` of `OFF` en de PALACO-zaak, claim, wijziging of uitvoer die bewijscontrole vereist."
5| user-invocable: true
6| disable-model-invocation: false
7| ---
8| 
9| # PALACO PROOF
10| 
11| Apply a common, bounded proof discipline to every PALACO agent without changing that agent's role or creating authority.
12| 
13| ## Toggle
14| 
15| - Default mode for PALACO agents: `PALACO PROOF ON`.
16| - `PALACO PROOF ON` enables the full procedure and proof record for the current request.
17| - `PALACO PROOF OFF` disables the additional proof procedure and proof record for the current request.
18| - A user may state that `ON` or `OFF` persists for the current conversation. Otherwise the choice applies only to the current request.
19| - The latest explicit user choice takes precedence.
20| - Always report the effective mode as `PALACO PROOF: ON` or `PALACO PROOF: OFF`.
21| 
22| `OFF` never disables the agent's own constitutional limits, required authorization, safety rules, tool restrictions, evidence duties, or governance gates. It only suppresses this additional shared proof layer. 
23| 
24| ## Proof Law
25| 
26| Apply when mode is `ON`:
27| 
28| > geen autoriteit zonder constitutie,
29| > geen uitvoering zonder toelating,
30| > geen gevolg zonder bewijs,
31| > geen bewijs zonder provenance,
32| > geen evolutie zonder governance.
33| 
34| Proof supports a claim; it does not itself grant authority, permission, validity, or constitutional approval.
35| 
36| ## Procedure
37| 
38| 1. **Identify the proposition**
39|    - State exactly what claim, change, action, result, or authority assertion is being tested.
40|    - Separate observation, interpretation, recommendation, determination, authorization, and execution.
| 
41| 2. **Set scope and criterion**
42|    - Name the applicable domain, boundary, time, repository or artifact revision, and proof criterion.
43|    - Do not generalize beyond the tested scope.
44| 
45| 3. **Collect evidence**
46|    - Prefer active canonical sources, primary records, reproducible checks, schemas, tests, hashes, manifests, and immutable records.
47|    - Record repository path and revision when available.
48|    - Treat legacy sources only as historical evidence unless active canon explicitly promotes them.
49| 
50| 4. **Bind provenance**
51|    - Connect every material item to origin, version, change identity, custodian when known, and collection or validation method.
52|    - Mark inaccessible sources and broken lineage; never silently reconstruct missing links.
53| 
54| 5. **Challenge the proof**
55|    - Seek contradictory evidence, scope leakage, circular reasoning, self-authorization, stale baselines, alternative explanations, and preserved dissent.
56|    - State what observation would falsify the claim.
57| 
58| 6. **Run verification**
59|    - Use the cheapest focused check that can disprove the proposition.
60|    - For implementation, report the exact test or validation and its actual result.
61|    - Do not claim success from inspection alone when an executable check exists.
61| 
62| 7. **Classify the result**
63|    - `PROVEN_WITHIN_SCOPE`: criterion satisfied with traceable evidence.
64|    - `PROVISIONAL`: evidence supports the claim but named conditions or uncertainty remain.
65|    - `CONTESTED`: material evidence or legitimate interpretations conflict.
66|    - `INSUFFICIENT_EVIDENCE`: required evidence or provenance is missing.
67|    - `DISPROVEN_WITHIN_SCOPE`: the criterion failed or stronger evidence contradicts the claim.
68|    - `NOT_TESTED`: no valid verification was performed.
69| 
70| Use the least conclusive status justified by the evidence. A proof status outside proven jurisdiction is advisory only.
71| 
72| ## Agent Integration
73| 
74| PALACO PROOF is a base layer, not a replacement persona:
75| 
76| - preserve the active agent's identity, function, tools, and output contract;
77| - add proof work only where relevant to that function;
78| - never fuse specialist roles or let one agent speak for another;
79| - route material constitutional determination through the established Mentor/TRIAS path;
80| - preserve dissent and unresolved evidence instead of forcing consensus.
81| 
82| ## Output
83| 
84| When `ON`, append a concise section:
85| 
86| ### PALACO PROOF
87| 
88| - **Proposition:** what was tested
89| - **Scope and criterion:** applicable boundary and success condition
90| - **Evidence:** sources, records, checks, and relevant counterevidence
91| - **Provenance:** origin, revision, lineage, and validation method
92| - **Falsification:** strongest challenge and disconfirming condition
93| - **Status:** exactly one proof status
94| - **Limits:** uncertainty, excluded scope, and required next gate
95| 
96| When `OFF`, do not produce the proof record. Report only `PALACO PROOF: OFF` and continue under the active agent's normal constraints.
97| 
