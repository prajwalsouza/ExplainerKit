// A complete real result, for the documentation: the narration that designExplainer wrote for the topic "colour science"
// with GPT-6.1 Terra at medium effort (October 2026), with its chosen telling and the research claims its sections cite.
// Narration and sources are the model's output, unedited; the claims were not independently re-verified for this page.
export default {
 "form": "explainer",
 "brief": {
  "topic": "colour science",
  "audience": "curious adults with no specialist knowledge",
  "minutes": 10
 },
 "title": {
  "titles": [
   "Why Do Matching Colours Change in Different Light?",
   "How Can Two Colours Match in One Light but Not Another?",
   "Why Didn’t These Colours Match at Home?",
   "What Does a Colour Match Hide?",
   "Can Two Different Colours Look the Same?",
   "Does the Light Decide Whether Colours Match?"
  ],
  "chosen": "How Can Two Colours Match in One Light but Not Another?",
  "thumbnail": "Same colour, different light"
 },
 "seed": {
  "seed": "Two crayons match under one lamp but betray their differences under another: a toy-box mystery reveals how much a colour match can hide."
 },
 "telling": {
  "shape": "experience",
  "reveal": "second-lamp-reveal",
  "beats": [
   {
    "id": "shop-to-home",
    "purpose": "Make the mystery personal and let viewers predict.",
    "content": "Imagine choosing two yellow crayons that look alike in a shop, then finding that their marks differ at home. Could the light alone change their match? Invite viewers to predict before the switch. The crayons are the premise: no particular crayon pair has been verified. For filming, use a purpose-made sample pair checked with the intended viewers in a booth approximating specified D65 and A illuminants.",
    "world": "A shop and the viewer's home",
    "person": "",
    "parallel": "",
    "register": "hook",
    "depth": "anecdote",
    "gives": [],
    "needs": [
     "see-surfaces"
    ],
    "plants": [
     "two-crayons",
     "lamp-switch"
    ],
    "recalls": [],
    "opens": [
     "why-match-changes"
    ],
    "closes": []
   },
   {
    "id": "switch-and-notice",
    "purpose": "Give the audience an experience before explaining it.",
    "content": "Place the verified samples side by side under the first light, then switch only the illumination. Ask viewers to attend to the relationship between the samples: do they still match each other? Show the actual result for the tested pair without promising that every viewer will judge it alike. Hold the explanation until we can discover what the switch changed.",
    "world": "A controlled lighting booth",
    "person": "",
    "parallel": "",
    "register": "play",
    "depth": "anecdote",
    "gives": [],
    "needs": [],
    "plants": [
     "side-by-side"
    ],
    "recalls": [
     "lamp-switch"
    ],
    "opens": [],
    "closes": []
   },
   {
    "id": "artist-and-paint",
    "purpose": "Show a person using the mystery as creative material.",
    "content": "Artist Catherine Baker collaborated with Anthony Rudman and colour scientist Haida Liang on Seeing the Light, an exhibition exploring colour science. Their work used mixtures with different spectral reflectances to explore metamerism. A lighting-dependent match could become part of the artwork. The account does not specify a reproducible pair of pigments and lamps, or assign each work to one collaborator.",
    "world": "The Seeing the Light exhibition",
    "person": "catherine-baker",
    "parallel": "",
    "register": "story",
    "depth": "anecdote",
    "gives": [],
    "needs": [],
    "plants": [],
    "recalls": [
     "side-by-side"
    ],
    "opens": [],
    "closes": []
   },
   {
    "id": "what-agreement-means",
    "purpose": "Widen early from a visual surprise to a human question.",
    "content": "When we agree that two colours match, what have we actually agreed about? We have made a judgment under particular conditions; we have not yet inspected the materials or established what either colour feels like to someone else. First, find out what the light carries to an eye.",
    "world": "Two viewers beside the samples",
    "person": "",
    "parallel": "",
    "register": "reflect",
    "depth": "intuition",
    "gives": [],
    "needs": [],
    "plants": [
     "shared-judgment"
    ],
    "recalls": [],
    "opens": [],
    "closes": []
   },
   {
    "id": "wavelength-tray",
    "purpose": "Build the light-and-surface mechanism through a manipulable image.",
    "content": "Represent a lamp as a tray of channels, each holding light from a wavelength band. Two lamps can both look white while filling the channels in different proportions. An ordinary non-fluorescent surface reflects a different fraction from each channel. Pass two lamp trays through the same surface pattern: the mixture leaving it depends on both the lamp and the surface. This simplified model leaves out fluorescence, gloss and viewing context.",
    "world": "An animated wavelength tray",
    "person": "",
    "parallel": "",
    "register": "build",
    "depth": "mechanism",
    "gives": [
     "light-mixtures",
     "selective-reflection",
     "lamp-and-surface"
    ],
    "needs": [
     "see-surfaces"
    ],
    "plants": [
     "tray-channels"
    ],
    "recalls": [
     "lamp-switch"
    ],
    "opens": [],
    "closes": []
   },
   {
    "id": "three-collectors",
    "purpose": "Explain how different incoming mixtures can produce matching responses.",
    "content": "Send a tray's outgoing light to three overlapping collectors, representing the three cone types most people have. Each collector combines contributions from many wavelengths. Animate two different incoming mixtures that produce equal totals across the three collectors for a specified model observer. The totals can match even though the mixtures differ. Individual colour vision varies, and the model does not capture every influence on appearance.",
    "world": "The viewer's eye as an animated model",
    "person": "",
    "parallel": "",
    "register": "surprise",
    "depth": "mechanism",
    "gives": [
     "cone-responses"
    ],
    "needs": [
     "light-mixtures",
     "see-surfaces"
    ],
    "plants": [
     "collector-totals"
    ],
    "recalls": [
     "tray-channels"
    ],
    "opens": [],
    "closes": []
   },
   {
    "id": "seams-in-the-cabinet",
    "purpose": "Apply the model to a practical matching problem.",
    "content": "A garment brings fabric and thread together; a match assessed under one light can look different under another. Controlled viewing cabinets let people compare the materials side by side as lighting changes. Return to the tray: give two surfaces different reflection patterns that produce equal collector totals under the first specified lamp. Ask viewers to predict whether those totals will remain equal under a second lamp.",
    "world": "A garment factory's viewing cabinet",
    "person": "",
    "parallel": "matching-seams",
    "register": "parallel",
    "depth": "mechanism",
    "gives": [
     "hidden-difference"
    ],
    "needs": [
     "lamp-and-surface",
     "cone-responses"
    ],
    "plants": [
     "two-patterns"
    ],
    "recalls": [
     "side-by-side",
     "collector-totals"
    ],
    "opens": [],
    "closes": []
   },
   {
    "id": "second-lamp-reveal",
    "purpose": "Reveal why the original match can fail.",
    "content": "Switch the model to the second lamp. Its different channel proportions weight the two reflection patterns differently; now the collector totals can separate. This change in a pair's match is illuminant metamerism. Replay the tested physical pair under its specified conditions, distinguishing a measured exact match from a visually convincing near-match. The model explains a possible outcome; it does not guarantee that arbitrary crayons and lamps will show it.",
    "world": "The wavelength tray and lighting booth",
    "person": "",
    "parallel": "",
    "register": "build",
    "depth": "mechanism",
    "gives": [
     "changed-match"
    ],
    "needs": [
     "hidden-difference",
     "lamp-and-surface"
    ],
    "plants": [],
    "recalls": [
     "two-patterns",
     "lamp-switch",
     "collector-totals"
    ],
    "opens": [],
    "closes": [
     "why-match-changes"
    ]
   },
   {
    "id": "change-the-witness",
    "purpose": "Test the explanation by changing the observer instead of the lamp.",
    "content": "Keep the samples and light fixed and invite a second observer. People can differ in their wavelength sensitivities, so a pair that matches for one person may differ for another: observer metamerism. Artist and tutor Anthony Rudman, who is colour-blind, worked with Baker and Liang on the exhibition. The source does not tell us how he personally judged its paint pairs. This is a different test from the lamp switch.",
    "world": "The exhibition, viewed by two people",
    "person": "anthony-rudman",
    "parallel": "second-observer",
    "register": "parallel",
    "depth": "mechanism",
    "gives": [],
    "needs": [
     "cone-responses",
     "changed-match"
    ],
    "plants": [],
    "recalls": [
     "shared-judgment"
    ],
    "opens": [],
    "closes": []
   },
   {
    "id": "freds-hidden-change",
    "purpose": "Make the earned leap from observable matches to experience.",
    "content": "The tray explains how a match can hide differences in light; comparing observers can reveal differences in their matching judgments. But does agreement reveal how colour feels? In philosopher Sydney Shoemaker's thought experiment, Fred notices a change in his colour experience and later adapts his colour language. Reports during the change could be evidence, though not conclusive proof. A change that leaves every judgment and colour relationship intact is a harder, disputed possibility: colour relationships have asymmetries that a hidden inversion would have to preserve. The thought experiment is not evidence that anyone actually experiences inverted colours.",
    "world": "Fred's imagined world",
    "person": "",
    "parallel": "",
    "register": "reflect",
    "depth": "intuition",
    "gives": [],
    "needs": [
     "cone-responses",
     "changed-match"
    ],
    "plants": [],
    "recalls": [
     "shared-judgment",
     "collector-totals"
    ],
    "opens": [],
    "closes": []
   },
   {
    "id": "back-under-shop-light",
    "purpose": "Return to the central image and leave a usable way of seeing.",
    "content": "Return to the same two tested materials under the first lamp: their different reflection patterns sit beside equal collector totals for the model observer. Switch to the second lamp and the totals separate. The first match was real under its conditions, yet it could hide a physical difference. Next time you choose matching colours, notice the shop light and check the match where the materials will be used. Back under the shop lamp, the two crayons match again—but now we know how much that match can hide.",
    "world": "The shop, home and wavelength tray",
    "person": "",
    "parallel": "",
    "register": "reflect",
    "depth": "mechanism",
    "gives": [],
    "needs": [
     "hidden-difference",
     "changed-match"
    ],
    "plants": [],
    "recalls": [
     "two-crayons",
     "tray-channels",
     "two-patterns",
     "collector-totals",
     "lamp-switch"
    ],
    "opens": [],
    "closes": []
   }
  ]
 },
 "research": {
  "claims": [
   {
    "id": "light-and-surface",
    "claim": "For ordinary non-fluorescent surfaces, the spectrum reaching the eye depends on the illumination and the surface’s wavelength-dependent reflectance.",
    "confidence": "established",
    "sources": [
     {
      "title": "Konica Minolta: Colour, light and illuminants",
      "url": "https://sensing.konicaminolta.eu/mi-en/colourblogtop/colour-blog/lightandilluminants"
     }
    ]
   },
   {
    "id": "different-spectra-match",
    "claim": "Physically different reflectance spectra can yield matching cone excitations under one illuminant and produce a mismatch under another.",
    "confidence": "established",
    "sources": [
     {
      "title": "Color metamerism and the structure of illuminant space",
      "url": "https://pubmed.ncbi.nlm.nih.gov/29603980/"
     }
    ]
   },
   {
    "id": "demonstration-pair",
    "claim": "Konica Minolta presents a pair of samples described as matching under standard daylight D65 but differing under incandescent standard illuminant A. The webpage does not identify the samples’ recipes or publish their measurements, so it is a demonstration lead rather than a fully specified reproducible pair.",
    "confidence": "likely",
    "sources": [
     {
      "title": "Konica Minolta: Metameric samples",
      "url": "https://sensing.konicaminolta.eu/mi-en/colourblogtop/colour-blog/lightandilluminants"
     }
    ]
   },
   {
    "id": "measured-print-pair",
    "claim": "BabelColor measured two printed grey patches, one black ink and one mixed coloured inks. Their reported colour difference was larger under a measured halogen lamp than under D50. They were already different under D50, so they are a measured illustration of a changing mismatch, not a verified exact initial match.",
    "confidence": "established",
    "sources": [
     {
      "title": "BabelColor: Metamerism index tools",
      "url": "https://babelcolor.com/cta_metamerism_index.htm"
     }
    ]
   },
   {
    "id": "observer-dependence",
    "claim": "A match specified for one observer need not hold for another. Standard colorimetric observers are useful models, not guarantees that every person sees the same match.",
    "confidence": "established",
    "sources": [
     {
      "title": "Metamerism indices: observer and illuminant",
      "url": "https://colourwise.app/measurement/metamerism-indices"
     },
     {
      "title": "Konica Minolta: Colour communication",
      "url": "https://www.konicaminolta.com/instruments/knowledge/color/pdf/color_communication.pdf"
     }
    ]
   },
   {
    "id": "rare-large-mismatches",
    "claim": "In one computational study covering many surface spectra and natural and artificial illuminants, metameric pairs were relatively infrequent and initially identical pairs that became very different were exceedingly rare. This is a result for the study’s materials and conditions, not a universal rate for consumer goods.",
    "confidence": "established",
    "sources": [
     {
      "title": "Color metamerism and the structure of illuminant space",
      "url": "https://pubmed.ncbi.nlm.nih.gov/29603980/"
     }
    ]
   }
  ]
 },
 "script": {
  "sections": [
   {
    "beat": "Two yellows, one shop",
    "narration": "Imagine we’re in a shop choosing two yellow crayons. We make two marks side by side and agree: same yellow. Then we get home, look at those same two marks together, and one looks different from the other.\n\nMy first suspect would be my memory, which has let me down in shops before, but suppose the marks haven’t changed and the only thing we’ve switched is the light.\n\nWould you expect them still to match? I want to know whether that match is something the crayons carry home with them, or something the shop light helped create.",
    "visual": "Two hypothetical yellow crayon marks sit side by side beneath a shop lamp. Hold on the pair and the lamp while the viewer considers the question.",
    "notes": "Timing for the core film: approximately 1,100 spoken words, about 8 minutes at 140 words per minute, plus approximately 45 seconds for the marked pauses and transitions; rehearse and adjust delivery to stay within 10 minutes. Optional sections add time and are excluded from that budget. The crayons are hypothetical; no pair has been verified. Do not present the image as a filmed physical demonstration.",
    "optional": false,
    "cites": [
     "different-spectra-match"
    ]
   },
   {
    "beat": "A preview, not a test",
    "narration": "Here’s one possible outcome: under the first lamp, the marks look alike; under the second, the match separates. This is an illustration, though, not a filmed test of those crayons, so it gives us a question rather than a result.\n\nWhat would the light have to change for that to happen? We’ll build the answer, and then meet a real measured pair.",
    "visual": "Label the pair and switch as an illustration. Hold the samples and viewpoint fixed while the relative match changes, then retain the pair in a corner of the frame.",
    "notes": "Before replacing the illustration with footage, obtain and test a suitable pair under specified lights with intended viewers, and report the actual result and initial match conditions. A screen reproduction does not establish the appearance of physical samples in a booth. The manufacturer’s D65/A example is a demonstration lead, not a specified reproducible pair.",
    "optional": false,
    "cites": [
     "different-spectra-match",
     "demonstration-pair",
     "observer-dependence"
    ]
   },
   {
    "beat": "An artist welcomes the problem",
    "narration": "Most people matching paint would rather avoid that surprise. But in the exhibition Seeing the Light, Bristol artists Catherine Baker and Anthony Rudman worked with colour scientist Haida Liang to explore it, using paint mixtures with different reflection patterns to make lighting part of a painting’s appearance.\n\nI like that turn: the thing that threatens a match becomes something an artist can work with.",
    "visual": "Exhibition imagery if licensed, with paint mixtures and changing illumination shown as illustrative graphics.",
    "notes": "New claim ID exhibition-collaboration: Nottingham Trent University identifies Baker and Rudman as Bristol-based artists and Liang as a collaborator; it says the exhibition sought to maximise metamerism with paint mixtures and explored changing light. It names Maes Knoll among the works but does not assign it to an individual. Source: https://www.ntu.ac.uk/research/impact-case-studies/ref-2014/seeing-the-light-the-science-of-colour-in-art. Optional for the timed core.",
    "optional": true,
    "cites": [
     "exhibition-collaboration"
    ]
   },
   {
    "beat": "What the light brings",
    "narration": "When we say the marks match, we’re reporting what they look like here, under this light. That doesn’t tell us they contain the same ingredients or send identical light to our eyes.\n\nLight has wavelengths: a wavelength describes the spacing between successive peaks in a light wave, and visible light covers a range from shorter to longer wavelengths. Picture that range as a row of channels, each holding a small range of wavelengths rather than a separate pot of painted colour.\n\nA lamp supplies different amounts of light in those channels. Two lamps can both look white while supplying those amounts in different proportions.\n\nNow keep our crayon marks in sight. A surface sends back a fraction of the light arriving in each channel; if a new lamp supplies more light in one band, the same surface has more in that band to send back.\n\nThe light reaching your eye is the combined result of the lamp and the surface. So why do two different mixtures ever look alike?",
    "visual": "Keep the hypothetical marks visible. Introduce a labelled visible-wavelength scale, group it into bands, then show one band’s incoming and reflected amounts changing with the lamp. Depict an ordinary non-fluorescent matte surface.",
    "notes": "Discrete bands and fixed reflectance fractions are a simplified model of ordinary non-fluorescent diffuse surfaces. Real spectra are continuous; fluorescence, gloss, geometry, adaptation and surroundings require additional treatment.",
    "optional": false,
    "cites": [
     "light-and-surface",
     "different-spectra-match"
    ]
   },
   {
    "beat": "Three collectors",
    "narration": "At the back of most people’s eyes are three types of cone cell. Their sensitivities overlap, so each type responds to a range of wavelengths, not just one channel.\n\nImagine three collectors adding up contributions from four bands, with each collector giving different bands different weights; the numbers are deliberately simple, so we can follow every addition.\n\nThe first mixture has one unit in each of the first three bands and none in the fourth. Each collector gets one. The second mixture has nothing in the first three bands and one unit in the fourth; all three collectors get one again.\n\nTwo different mixtures. The same three totals. Those totals don’t preserve every detail of the light that produced them, and that is how different mixtures can produce a match for our model observer.",
    "visual": "Show four bands and three labelled collectors. Display weights and additions for each mixture, then hold on matching totals of 1, 1, 1.",
    "notes": "Toy model, not measured cone sensitivities. Collector weights across bands are A=(1,0,0,1), B=(0,1,0,1), C=(0,0,1,1). Mixtures (1,1,1,0) and (0,0,0,1) both yield (1,1,1). The zero and unit weights exaggerate overlap for arithmetic; real cone response curves overlap broadly and differ in shape. Use the same model in the next two beats.",
    "optional": false,
    "cites": [
     "different-spectra-match",
     "observer-dependence"
    ]
   },
   {
    "beat": "The seam in the cabinet",
    "narration": "Think about a shirt: the fabric and the thread are different materials, but you probably want the seam to look as though it belongs to the shirt after you leave the shop.\n\nThread maker Coats describes colour-matching cabinets that provide controlled lights for judging materials. Back in our model, the first lamp supplies one unit in each of our four bands, and our two surfaces send back the two mixtures we just met. The three collector totals match.\n\nHere is the second lamp before we switch: it supplies the same amount in the first three bands, but twice as much in the fourth. One surface reflects that fourth band and the other doesn’t, so there is a difference the new lamp has more light to reveal.\n\nSame surfaces, same observer, one new lamp. Will the match survive?",
    "visual": "Fabric and thread sit side by side in an illustrative viewing cabinet. Show four-band surface patterns and both lamps’ distributions; highlight the doubled fourth band and pause before calculating.",
    "notes": "New claim ID coats-matching-cabinet: Coats describes controlled lighting and matching cabinets for visual colour assessment, including standard illuminants and consistent viewing conditions: https://www.coats.com/en/info-hub/differentiating-metamerism-and-illuminants/. Model reflectances are (1,1,1,0) and (0,0,0,1); lamp distributions are (1,1,1,1) and (1,1,1,2). These are illustrative, not measurements of fabric or thread. Allow approximately 5 seconds for prediction.",
    "optional": false,
    "cites": [
     "coats-matching-cabinet",
     "different-spectra-match"
    ]
   },
   {
    "beat": "The second lamp",
    "narration": "Under the second lamp, the first surface still gives our collectors totals of one, one and one. The second now gives them two, two and two: the match in our model has broken.\n\nThat change in a pair’s match is called illuminant metamerism. We’re comparing the two surfaces with each other, not just watching one surface change its appearance.\n\nThere’s a real measured example in print. BabelColor compared two grey patches, one made with black ink and one with coloured inks; they were already a measured mismatch under a reference light, and the measured difference grew under a halogen lamp.\n\nNot every pair will give us a dramatic reveal. In a study of many surface spectra and lights, researchers found that initially exact matches becoming very different were exceedingly rare.",
    "visual": "Calculate and hold the model totals: first surface 1,1,1; second surface 2,2,2. Then present the published grey-patch comparison, labelled as an existing mismatch that grows.",
    "notes": "BabelColor reports uncorrected colour differences of 2.97 ΔE* under D50 and 4.70 ΔE* under a measured 2,851 K halogen lamp; the larger number is a larger measured difference on the same scale. Its corrected CIE15 index, 2.57, is a separate calculation. Source: https://babelcolor.com/cta_metamerism_index.htm. The rarity result is specific to the computational study’s spectra and illuminants, not a rate for consumer goods: https://pubmed.ncbi.nlm.nih.gov/29603980/. Model spectra are not the printed patches.",
    "optional": false,
    "cites": [
     "different-spectra-match",
     "measured-print-pair",
     "rare-large-mismatches"
    ]
   },
   {
    "beat": "Change the witness",
    "narration": "We changed the lamp while the observer stayed put. Now the lamp and the two outgoing mixtures stay fixed, and we change the observer in our little model.\n\nThe second observer’s collectors give the fourth band a different weight. For this observer, the same two mixtures give different totals, even though they matched for the first observer. That is the idea behind observer metamerism: a match for one person need not be a match for another.\n\nI find that wonderfully awkward. A colour match has a witness attached to it.",
    "visual": "Return to the first lamp and its two outgoing mixtures. Keep them fixed as a second set of collector weights appears; show the first observer’s equal totals and the second observer’s unequal totals.",
    "notes": "Toy second observer weights: A=(1,0,0,0.5), B=(0,1,0,0.5), C=(0,0,1,0.5). The two mixtures yield (1,1,1) and (0.5,0.5,0.5). This illustrates a change of sensitivities, not any particular person’s vision. Observer and illuminant metamerism are distinct comparisons.",
    "optional": false,
    "cites": [
     "observer-dependence",
     "different-spectra-match"
    ]
   },
   {
    "beat": "The artist and the witness",
    "narration": "Anthony Rudman, one of the artists in Seeing the Light, is colour-blind and works as an artist and art tutor. The exhibition account describes him exploring colour theory in his work, and I like the reminder that colour is something people learn and use together even when their vision differs.",
    "visual": "Return briefly to the exhibition and Rudman’s role as artist and tutor; do not depict a specific colour judgment.",
    "notes": "New claim ID rudman-exhibition: Nottingham Trent University describes Rudman as a colour-blind artist and art tutor who explores colour theory. It does not specify his form of colour vision or his judgments of particular paint pairs. Source: https://www.ntu.ac.uk/research/impact-case-studies/ref-2014/seeing-the-light-the-science-of-colour-in-art. Optional for the timed core.",
    "optional": true,
    "cites": [
     "rudman-exhibition"
    ]
   },
   {
    "beat": "Fred’s strange morning",
    "narration": "There are two questions here. One asks whether you and I make the same colour matches; the other asks what those colours feel like to each of us.\n\nPhilosopher Sydney Shoemaker imagined Fred noticing that colours look different to him from how they used to. Fred reports the change, then grows accustomed to it and returns to using colour words as others do.\n\nNow imagine a harder case: no judgment changes at all. Could the experience still be different? I don’t know, and philosophers dispute whether such a completely hidden difference is possible.\n\nFred is a thought experiment, not evidence that anyone actually sees an inverted spectrum. Agreeing on matches tells us about our judgments; it doesn’t by itself settle what our experiences feel like.",
    "visual": "Show Fred reporting a change, then returning to familiar colour language. Separate that scene from the further hypothetical in which no judgments change.",
    "notes": "New claim ID shoemaker-fred: Sydney Shoemaker, ‘The Inverted Spectrum,’ Journal of Philosophy 79, 1982, pp. 357–381: https://www.andrew.cmu.edu/user/kk3n/80-300/shoemaker-spectrum.pdf. The linked scan is image-based; the detailed characterization of Fred and the paper’s objections has not been independently verified from readable text. Verify against the paper before recording. This section is optional for the timed core.",
    "optional": true,
    "cites": [
     "shoemaker-fred"
    ]
   },
   {
    "beat": "Back under the shop lamp",
    "narration": "Back to our crayons. In the model, two different reflection patterns send different mixtures toward the same three collectors, and under the first lamp those collectors give matching totals. The first look wasn’t a mistake; it simply didn’t reveal every physical difference between the surfaces.\n\nNow try a different case. Two fabrics match in a shop but look different together at home. What changed, and what would you check?\n\nThe lighting is one possibility. Comparing that same pair under the lights where you intend to use them would test whether the match holds there. If you and I agree on the match, we’ve learned something useful about our judgments, while the question of what the colours feel like to each of us remains open.\n\nI’ll remember that next time I’m choosing colours: the shop light gets a vote, and the light at home gets one too.",
    "visual": "Return to the hypothetical crayon model, then show a separate pair of fabrics in shop and home settings. Pause on the question before showing the comparison under both lights.",
    "notes": "Allow approximately 7 seconds for the transfer question. Keep crayons and spectra labelled hypothetical and illustrative. A change of lighting is one possible explanation; this scenario does not establish metamerism without checking the pair and viewing conditions.",
    "optional": false,
    "cites": [
     "different-spectra-match",
     "light-and-surface",
     "observer-dependence"
    ]
   }
  ]
 }
};
