# Summative submission and 8-minute video guide

Use fictional patient details throughout. Record your own screen and voice. The rubric requires a **self-recorded video lasting 5–10 minutes**; the outline below targets about 8 minutes. Use the live public URL during the recording. If a feature is a prototype limitation, say so rather than describing it as deployed clinical infrastructure.

## What to say and show

| Time | Screen | Suggested narration |
|---|---|---|
| 0:00–0:55 | Public app URL, sign-in | “Maternawell Nigeria supports postnatal depression screening and referrals at primary health centres. Paper-based screening can delay scoring, lose follow-ups, and leave urgent cases hard to track, especially with unreliable connectivity. The proposed solution is an offline-capable screening and referral app with separate health worker, supervisor, administrator, and anonymous mother flows.” |
| 0:55–1:45 | Sign in as HW-01; dashboard and navigation | “This is the health worker account. Sign-in identifies the staff member and facility, and the dashboard shows cases and sync status. The public prototype uses fictional data.” |
| 1:45–3:25 | New screening, consent, questions, result | “I record informed consent, then answer the ten Edinburgh Postnatal Depression Scale questions, one at a time. The app computes the score and applies the SRS cutoff: zero to eight is low, nine to twelve is moderate, and thirteen or above is high. It immediately recommends the relevant referral pathway. This is screening, not a diagnosis.” Complete a fictional moderate-risk example. |
| 3:25–4:20 | Item 10 urgent flow | “Any nonzero response to Item 10 triggers the same-day safety workflow, even if the total score is low. The health worker must confirm immediate safety steps. The case remains visible for supervisor acknowledgement.” Use a second fictional case or a prepared case. Do not enter a real person's answers. |
| 4:20–5:10 | Cases, follow-up, offline/sync status | “The health worker can record contact and follow-up outcomes. Changes save locally and queue for synchronization when connectivity returns. The sync indicator shows the state. In a real offline emergency, staff must hand off directly; the app does not send background SMS or push alerts.” If possible, briefly use browser offline mode and reconnect. |
| 5:10–6:05 | Sign out; SUP-01; supervisor dashboard | “The supervisor sees the facility queue, urgent flags, referral status, and follow-up workload. A supervisor opens an escalated case, reviews it, and acknowledges with notes. Access is role-scoped.” |
| 6:05–6:35 | Sign out; ADMIN-01; audit | “The administrator can inspect the facility audit trail. Actions are associated with staff identities and timestamps.” |
| 6:35–7:20 | Private window; self-referral | “A mother can complete an anonymous self-check without a staff account, choose a facility, and receive a reference code and guidance. The referral joins that facility’s queue after synchronization.” |
| 7:20–8:00 | GitHub README and public URL | “The public GitHub repository includes step-by-step installation, demo accounts, tests, and deployment instructions. The prototype is publicly accessible at this URL. The known limits are unvalidated Yoruba EPDS wording, no background SMS/push delivery, and no real-device clinical field validation.” |

Practice the workflow once before recording. Keep the clock visible while editing the video; the final export must remain between 5:00 and 10:00. Speak clearly, show each actor and page redirection, and make sure buttons actually work in the recording.

## Submission document

Create a Google Doc titled `Ndubuaku_Chigozie_Emmanuel_[Summative]_[MMDDYYYY]`, replacing `MMDDYYYY` with the **submission date**. Add these lines, replacing every placeholder with a verified link:

```text
Maternawell Nigeria — Final Prototype Summative
Presenter: Ndubuaku Chigozie Emmanuel

Self-recorded demo video (5–10 minutes): [video sharing URL]
Public GitHub repository: [public GitHub URL]
Publicly accessible prototype: [live HTTPS app URL]
Software Requirements Specification: [SRS sharing URL]
```

Upload the video to a service that provides a shareable URL and grants access to anyone with the link. The SRS PDF is also in this repository, but the rubric asks for an SRS **link**, so use its public GitHub file URL or another accessible document URL. Set the Google Doc sharing to **Anyone with the link → Viewer**. Finally, open the document, video, GitHub repo, SRS, and app links in a signed-out/private browser window. Confirm that each loads, the video plays, and the app's demo login works. A local file path or an inaccessible private link does not satisfy the rubric.
