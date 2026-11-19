# Required citation for reuse

User requirement, recorded 2026-10-27: cite the source dataset whenever these data
are used, including work continued by Claude or another agent.

## Full credit

> Source: Emory NLP, Emory University. *Character Mining — Friends corpus*.
> https://github.com/emorynlp/character-mining, revision
> `700f6fdadf4133765494d363522d581101e18b6e`, retrieved 2026-10-27.
> Shared-scene and consecutive-speaker-turn counts derived for ExplainerKit on
> 2026-10-27. Extraction method and source/output checksums accompany the dataset.

## Visible credit for a visualization

Use this wording with an active link to the source:

> Data: [Emory NLP Character Mining](https://github.com/emorynlp/character-mining).
> Interaction counts derived by ExplainerKit from shared scenes and consecutive
> speaker turns.

Place the credit in the visualization's caption or adjacent source note, readable
without inspecting code. Include it in exported images/reports where captions are
supported. A source comment alone does not satisfy this requirement.

## Downloads and derivatives

- Distribute this file, `SOURCE-LICENSE.txt` and `SOURCE-NOTICE.txt` with dataset
  bundles. Include the full credit in a neighbouring README/provenance file for
  individually distributed CSVs, whose numeric schema should remain unchanged.
- Retain the source revision, retrieval date, source URLs and checksums from
  `manifest.json`. Record any filtering, renamed characters, changed metric rules
  or additional transformations in the derivative's provenance.
- Credit Emory NLP as the source corpus and ExplainerKit as the count-extraction
  step. Do not describe this as original ExplainerKit transcript collection.
- Upstream's licence file declares Apache License 2.0. Its notice separately
  credits the show's producer and transcript websites and disclaims ownership of
  the transcripts. Preserve both files as supplied. Do not relabel the upstream
  corpus as CC0 or imply that the software licence establishes transcript rights.
- Label these measurements accurately: shared scenes with speaking participation
  and consecutive speaker transitions. They are proxies for interaction, with
  the limitations documented in `README.md`.

The current dataset ZIP includes this citation and both upstream attribution files.
