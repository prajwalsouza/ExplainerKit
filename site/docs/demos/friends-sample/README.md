# Landing samples: Friends

Small files the landing page's live chapter draws. The ghost file carries season one's speakers; the season dots under
the view switch between seasons and the whole series. Membership arcs and rim marks show speaking episodes;
the inner chords and chord view show measured consecutive speaker turns, in either direction. The Sample menu
also offers the undirected pair counts directly. Both measures are derived from the ExplainerKit Friends dataset in `datasets/friends/` by
[`derive-friends.py`](derive-friends.py) (standard library; run from the repository root).

| File | Columns | Contents |
| --- | --- | --- |
| `friends-s1-speakers.csv` … `friends-s10-speakers.csv` | `episode,speaker` | Each episode of that season and who speaks in it: the six leads, the named recurring speakers heard in two or more of its episodes (up to 15 names), and `Others` for everyone else who speaks. |
| `friends-all-episodes.csv` | `episode,speaker` | All 236 episodes (`3x12` is season 3, episode 12): the six leads, the nine named speakers heard in the most episodes, and `Others` for everyone else. |
| `friends-s1-conversations.csv` … `friends-s10-conversations.csv` | `from,to,turns` | Positive consecutive-turn counts between each season's displayed speakers, including `Others`, summed over that season. The endpoints are unordered; `from`/`to` are CSV field names, not direction or addressee labels. |
| `friends-all-conversations.csv` | `from,to,turns` | The same undirected counts across all ten seasons, using the exact visible cast of `friends-all-episodes.csv`. |
| `friends-all-episode-turns.csv` | `episode,from,to,turns` | The same undirected counts and cast, kept separate for each of the 236 episodes (`3x12` is season 3, episode 12). Their sum equals `friends-all-conversations.csv`. The documentation's interactive chart plays through these episodes. |
| `friends-derived-manifest.json` | JSON | Source revision/hashes, output hashes, selected source-to-display names, and displayed/omitted/source turn totals for all eleven samples. |

## Source and credit

> Source: Emory NLP, Emory University. *Character Mining — Friends corpus*.
> https://github.com/emorynlp/character-mining, revision
> `700f6fdadf4133765494d363522d581101e18b6e`, retrieved 2026-10-27.
> Shared-scene and consecutive-speaker-turn counts derived for ExplainerKit on
> 2026-10-27. Extraction method and source/output checksums accompany the dataset.

The page shows the visible credit from [CITATION.md](CITATION.md), with a link to the source, whenever these
files are on screen. The upstream licence ([SOURCE-LICENSE.txt](SOURCE-LICENSE.txt), Apache-2.0) and notice
([SOURCE-NOTICE.txt](SOURCE-NOTICE.txt)) are kept as supplied; the notice credits the show's producer and the
transcript sites, and the software licence does not establish rights in the transcripts. No dialogue, plot text or
artwork is included: only who speaks in which episode, and counts of speaker turns.

## What the numbers mean

These are **speaking** measures, not screen time or appearances. A character who is on screen but silent is
absent; `speaks in` comes from the source's per-scene speaker lists. `turns` counts successive speech records by
two different, individually identified speakers within one scene (either order); see the dataset's README for
the full extraction rules and their limits.

These counts are **not annotated direct address**: consecutive speakers may address a third person.
All positive pairs are retained, without the older three-turn threshold. Endpoints outside a sample's named
cast are mapped to `Others`; transitions whose two endpoints both collapse into `Others` are omitted as
self-links. The manifest records that omitted amount. For season one, 5,176 displayed turns plus 70 omitted
within-`Others` transitions reconcile to 5,246 source turns. For the full series, 55,432 plus 682 reconcile to
56,114. A displayed group is an aggregate label, not one fictional character.

The membership CSV remains two columns and opens on the onion. Its companion is fetched and validated before
either enters the live data source, so a missing companion produces a visible load error and preserves the
previous view. Fast season/sample changes commit only the last requested complete sample. Dropped user CSVs
have no companion metadata and retain generic co-occurrence or directed-flow behavior.
Fetched CSV bodies are capped at 2,000,000 decoded bytes and 8,192 chunks before parsing; invalid UTF-8 is
rejected. These are bounds for the bundled examples, not a new fetch or resource lifecycle in the core.

## Filtering and renaming

- Every speaker is counted. Generic or collective labels (`Woman`, `Guy`, `Waiter`, labels beginning `The`, and
  similar; see `ROLES` in the script) are never shown by name, since they name roles rather than characters: they
  join `Others`, which is present in an episode when anyone not named in the file speaks in it.
- Names are shortened to first names where that stays unambiguous in the file (`Rachel Green` → `Rachel`);
  titled names keep their title (`Mr. Heckles`, `Dr. Long`), and clashes keep the full label (`Phoebe Abbott`).
- At most 16 entities per file (including `Others`), so the onion keeps every one. The corpus divides some seasons differently from
  broadcast listings (season 10 has 18 source episodes).

## Checksums

Every source input and all 22 derived CSV files have SHA-256 hashes in the
[derived manifest](friends-derived-manifest.json). The original eleven membership CSV byte sequences are
unchanged by the turn-count adoption. Run the derivation into another directory to compare all outputs:

```sh
python3 site/data/derive-friends.py --output /tmp/friends-derived
node --test tests/modules/landing-friends.test.js
```

The script copies the citation, licence and notice to the output directory too. Tests regenerate the complete
sample set, compare bytes and hashes, and independently sum the source episode-pair rows for every visible
cast. UI layout tests distinguish speaking-episode arcs from measured turns, and loading tests exercise
missing companions and out-of-order requests.
