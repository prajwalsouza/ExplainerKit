# How Can One Fan Sound Quieter to One Person?

Series · 8 minute read. This is the complete recorded narration, with paragraph breaks preserved.

[Back to the examples](design.md#read-complete-examples) · [Follow the process](design.md#follow-a-run-by-scrolling)

The writing and source links are model outputs from a recorded authoring run. The claims have not been independently rechecked for this reading page.

This is one of two treatments of the same sound unit. The series process combined the objectives into a single piece. Bracketed playback directions describe planned demonstrations.

## 1. Two listeners

There’s a fan running beside us. You can hear it; I can hear it. Then you put on headphones and switch noise cancellation on.

You give me a look. I’m still listening to the fan, while you lift one earcup and hear it clearly again; when you settle it back and switch cancellation off and on without changing the fit, the fan gets louder, then quieter.

The fan hasn’t stopped. My first instinct is to blame it anyway, which seems unfair to a machine doing exactly what it was asked to do. Something has changed between the fan and your ear.

A line appears beside the fan, rising and falling with the pressure in the air at one particular place. It isn’t the route of a tiny air particle flying across the room; it’s a picture of pressure changing over time.

We’ll follow that pattern into a microphone, take a brief detour into what a measurement leaves out, and return to the air beside your ear, where the two of us are hearing different things.

## 2. Count the pressure

Before the line goes anywhere, I want to make friends with its wiggles. Here are two simpler sounds than the fan: one steady tone, then another.

Which sounds higher? The second one. Over the same stretch of time, its pressure pattern completes more cycles: 440 cycles in a second gives us 440 hertz, while 880 cycles gives us 880 hertz. One hertz means one cycle per second.

Pitch is the highness or lowness you hear; frequency is the rate we count in the physical pattern. With these simple tones, faster repetition sounds higher, and I like keeping those two words apart because one describes a measurement while the other describes an experience.

The fan’s line is busier than either clean tone, but its changing pressure still reaches a microphone. What responds?

## 3. A pattern that travels

Inside a microphone there is a thin surface called a diaphragm. The fan’s changing pressure reaches it, and the diaphragm moves back and forth. The movement is small, and it changes as the pressure changes.

In 1860, Édouard-Léon Scott de Martinville used a diaphragm for a different job: his phonautograph moved an attached stylus across soot-blackened paper to make sound visible. One surviving sheet, dated April ninth, carries the wavering trace of a sung fragment of ‘Au clair de la lune.’

The machine couldn’t play it back. In 2008, researchers scanned the trace and interpreted its path to make an audible reconstruction; we don’t know for certain who sang it, and what we hear depends partly on choices made in that reconstruction.

I love that the mark survived even though the performance didn’t survive as an audio file. It records movement related to a sound, and our microphone diaphragm gives us another way to carry a changing pattern out of the air.

## 4. Coil listens

Here’s a moving-coil microphone, opened up so we can see inside. A small coil of wire is attached to the diaphragm, and a permanent magnet supplies a magnetic field around it.

A pressure change moves the diaphragm and coil, and the coil’s motion through the field induces a voltage across the wire. How fast it moves matters: at a turning point the coil briefly stops, so the motion-induced voltage passes through zero before reversing as the coil moves back.

Back and forth. A changing pressure has become a changing electrical signal.

The wire isn’t full of little packets of fan noise. The voltage follows the coil’s motion, which is related to the incoming sound but also shaped by the microphone’s own response. I find it satisfying that a moving piece of wire gives us a way to carry information from the air into an electrical circuit.

Other microphone designs do this differently. Once we have a signal, though, what do we do with it?

## 5. Signal not storage

A microphone can send its changing voltage to an amplifier and then a loudspeaker, which makes the air change pressure again. Someone hears the sound while it happens, even if nothing is saved.

Add a recorder and you have another job: keeping a representation for later. I used to lump those together, as if a microphone were already a little recording machine, but making a signal and storing it are separate things.

Here’s an optional detour, because I want to know what happens when a device measures a changing signal at separate instants and keeps only those measurements. It won’t tell us what’s inside your headphones; we’ll come back to pressure addition for the actual cancellation.

## 6. Glimpses of a wheel

Imagine a mark on a wheel, photographed once per frame. Between frames the wheel turns almost a whole revolution forward, so the mark lands a little behind its previous position in each picture.

Those same pictures also fit a wheel turning slowly backward. The frames are honest, but they don’t tell us which movement happened between them.

Now take a changing electrical signal and measure it 10,000 times a second: one sample every tenth of a millisecond. I’ll hide the curve and leave the dots; what path would you draw through them?

A smooth path seems reasonable, but more than one smooth path fits every mark. The dots preserve measurements, while the signal has had time to do something between them.

## 7. Two waves one record

Here are two paths through those dots: a 6,000-hertz cosine wave and a 4,000-hertz cosine wave. Both start at their maximum at the first sample, and both have the same amplitude—that’s the greatest distance each wave reaches from its middle line.

The curves take different routes between the marks. Yet every sampled value agrees. I had to sit with that one.

The dial helps: a point travels around a circle, and its horizontal position gives the wave’s height at each instant. At our first dot, both points start at the rightmost edge, so both waves are at their maximum.

By the next sample, the faster wave has gone forward six tenths of a turn, which lands at the same place as going backward four tenths. The slower wave has gone forward four tenths; its point is across the circle from the faster wave’s point vertically, but at the same horizontal position, so the two heights agree.

The same relationship holds at every sample. Two different waves, the same dots—and between those dots, they take different paths.

## 8. What playback chooses

Those dots fit two different waves. They cannot tell us which one went in.

A playback system needs a way to choose. In our example, ideal low-pass reconstruction chooses the compatible wave below half the sampling rate, on the assumption that the original contained no frequencies above that limit. Half of 10,000 is 5,000, so it produces the 4,000-hertz wave—even if the input was 6,000 hertz.

That lower frequency is an alias. A filter before sampling reduces higher frequencies and helps make the assumption a better fit; without it, the same measurements give us no way to distinguish these two inputs.

This is a calculation, not a recording made with your headphones. It tells us something useful about measurements, but it isn’t the operation that quiets our fan. For that, we need to add sounds in the air.

## 9. Adding at a point

Back in the air, there’s one operation we haven’t done with our fan line: add another sound to it.

At a particular point, overlapping pressure changes add together. Say the fan contributes plus two, and another sound contributes minus two at that same moment: the result is zero. If the second contribution is only minus one, there’s plus one left over.

The meeting place matters. Imagine two speakers playing the same steady tone: as you move around the room, the sounds reach you with different timing, so they reinforce each other in some places and reduce each other in others.

Reflections join in too, making a real room less tidy than our drawing. I like the consequence: you and I can stand near the same sources and hear different strengths because the pressure changes combine differently at our two positions.

## 10. Reveal near the ear

Back beside the fan, two pressure lines arrive at a point near your ear: one from the fan, one from the headphone speaker. Add them and, in our drawing, the combined line is smaller.

You give me that look again. I’m still hearing the fan out here.

The headphone uses microphone signals and electronics to drive its speaker, sending a sound that combines with the incoming noise near your ear. For a steady tone, we can draw a repeating opposing wave; the changing fan pattern needs the electronics to produce a suitable speaker signal in time for the two sounds to meet.

When their pressure changes match in strength and oppose each other at that point, the variation is reduced. Shift one line or make it too small and some variation remains, just as it did with our plus two and minus one.

The fan is still working. Your ear and mine are in different places, and the carefully adjusted speaker sound is aimed at the little space beside yours.

## 11. Back in the room

With the earcups in place, switching cancellation off and on gives us a better comparison of what the active system adds. The cups also block some sound, and even with cancellation on, some fan noise gets through.

Now suppose the opposing sound arrives too late. What happens near your ear? The lines no longer line up as opposites, so a pressure variation remains; the timing of the speaker’s contribution matters as much as its strength.

Researchers have measured a reduction in one intensive-care-unit setup, though that result doesn’t predict exactly what you’ll hear beside this fan. Sound takes time to travel, electronics and speakers take time to respond, and the fit of the earcup changes the paths sound can take.

What stays with me is our little disagreement: I hear the fan out here, while you hear less of it inside the cups. The fan sends pressure changes into the room, and near your ear those changes meet the speaker’s changes; their combined variation can be smaller.

## Recorded sources

These are the research links retained with the run.

- [Pitch Perception](https://pmc.ncbi.nlm.nih.gov/articles/PMC3481156/)
- [Questions and controversies surrounding the perception and neural coding of pitch](https://pmc.ncbi.nlm.nih.gov/articles/PMC9868815/)
- [The missing fundamental: interactive demonstration](https://munichmusiclabs.com/playground/missing-fundamental/)
- [Missing fundamentals: Periodicity and Pitch](https://auditoryneuroscience.com/index.php/pitch/missing-fundamentals)
- [First Sounds: recovery process](https://www.firstsounds.org/press/032708/release_2008-0327.pdf)
- [First Sounds FAQ](https://www.firstsounds.org/faq/)
- [Library of Congress: Phonautograms](https://blogs.loc.gov/now-see-hear/2021/08/from-the-recording-registry-phonautograms-c-1853-61/)
- [Shure: Microphone techniques for recording](https://www.shure.com/en-US/docs/education/Microphone-Techniques-for-Recording)
- [OpenStax University Physics: Motional emf](https://openstax.org/books/university-physics-volume-2/pages/13-3-motional-emf)
- [Shure SM58 user guide, specifications](https://pubs.shure.com/view/guide/SM58/en-US.pdf)
- [MIT OpenCourseWare: Lecture 16, Sampling](https://ocw.mit.edu/courses/res-6-007-signals-and-systems-spring-2011/8708ec068ebdea2c4ee2f38fad39fb83_MITRES_6_007S11_lec16.pdf)
- [MIT OpenCourseWare: Lecture 21, Sampling](https://ocw.mit.edu/courses/6-003-signals-and-systems-fall-2011/12e6e5d7567fca2e993ef8563fef5a60_MIT6_003F11_lec21.pdf)
- [Analog Devices: Filter Basics, Anti-Aliasing](https://www.analog.com/en/resources/technical-articles/guide-to-antialiasing-filter-basics.html?gated=1790899619215)
- [UCLA: Acoustical Interference](https://demoweb.physics.ucla.edu/content/10-acoustical-interference)
- [Arizona State University: Two Speaker Interference](https://pirt.asu.edu/demos/3B55.10)
- [Wolfson Microelectronics: Ambient Noise Cancellation for Headphones and Handsets](https://d3uzseaevmutz1.cloudfront.net/pubs/whitePaper/WP_Ambient_noise_cancellation_for_headphones_and_handsets.pdf)
- [AES: Objective Measurements of Headphone Active Noise Cancelation Performance](https://aes.org/publications/elibrary/elibrary-page/?id=20500)
- [Gallacher et al.: An Experimental Model of Active Noise Control in an ICU](https://link.springer.com/article/10.1186/s40635-017-0162-1)

[Back to the examples](design.md#read-complete-examples)
