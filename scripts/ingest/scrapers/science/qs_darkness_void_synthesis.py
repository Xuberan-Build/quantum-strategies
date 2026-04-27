"""
QS Darkness / Void Synthesis
Quantum Strategies synthesis document.

Core thesis: Darkness is not absence — it is maximum potential.
The unobserved field. Pure superposition. Every tradition names
the same state: the creative ground before form, where all
possibilities coexist and none are yet actual.

Two modes: the void you actively enter (practice), and the dark
night that happens to you (transformation). Both are necessary.
Declaration emerges from silence. New form requires old form to
dissolve first.
"""
from scrapers.base import BaseIngester
from chunk_utils import clean_text

THEMES = [
    "quantum_strategies", "darkness", "void", "emptiness", "superposition",
    "creation", "transformation", "apophatic", "via_negativa", "consciousness",
    "dark_night", "silence", "potential", "unmanifest",
]
CROSS_TAGS = [
    "transcendence", "ego_dissolution", "transformation", "consciousness",
    "stillness", "non_duality", "inner_kingdom",
]

SECTIONS = [

    ("nature_of_darkness", "What Darkness Is: Maximum Potential", """\
Darkness is not the absence of something. It is the presence of everything — unresolved, uncollapsed, unnamed.

Before the first word of Genesis, before the primal point of the Zohar, before the Grand Beginning of Zhuangzi, there is a state that every tradition gestures toward and none can fully describe. It is the state prior to form. Prior to observation. Prior to declaration. It is the ground from which all things arise and to which all things return.

Modern physics accidentally rediscovered this when it described quantum superposition. A quantum system, unmeasured, exists in all possible states simultaneously. It has no single definite position, no single definite value — only a field of probabilities, each equally real, none actualized. Darkness, in this frame, is the superposed state: maximum potential precisely because nothing has yet collapsed into form.

The Orch-OR hypothesis (Penrose and Hameroff) states it directly: "Superposition means that a quantum system can exist in multiple possible states at the same time until it is measured. A particle may not have a single definite position but instead be described by a range of probabilities. Only when an observation occurs does the system appear to collapse."

The observation event — the act of conscious attention and declaration — is the creative act. The darkness is not what you overcome to reach creation. The darkness is where you must go to create.
"""),

    ("kabbalistic_void", "The Kabbalistic Void: Ein Sof and the Tohu", """\
The Kabbalah offers the most precise cosmological map of darkness as creative ground.

Before the act of creation, there is Ein Sof — the Limitless, the Endless, the Absolute that has no boundary and no name. The Zohar says: "No trace can be found and to which thought cannot reach by any means." This is not God as a being among beings. It is the undifferentiated ground prior to any distinction, including the distinction between light and dark.

From this limitless darkness, a single point emerges — barely: "The primal point is the innermost light of a translucency, tenuity, and purity passing comprehension. The extension of that point becomes a palace, which forms a vestment for that point with a radiance which is still unknowable on account of its translucency."

The Sefer Yetzirah is explicit about the pre-creation state: Tohu — Hebrew for void, literally 'wasteland' — is the condition prior to form. Not chaos in the modern sense of disordered energy, but the Greek kháos: a void chasm, a state of emptiness and stillness. "He formed matter from chaos" — matter itself is carved from the void.

The Zohar on Genesis names four elements of the pre-creation state: Tohu (formlessness), Bohu (void), darkness, and spirit. These are not errors or deficiencies awaiting correction. They are the necessary conditions for creation. The earth "was without form, and void; and darkness was upon the face of the deep" (Genesis 1:2) — and it is precisely from this state that the declaration "Let there be light" becomes possible and potent.

Without the void, the word has nothing to work in. Without darkness, light has nothing to be divided from. The tohu is the superposed field. The declaration is the collapse event.
"""),

    ("taoist_wu", "The Taoist Wu: Non-Being as the Source", """\
The Tao Te Ching opens its cosmology with a paradox that is central to the QS understanding of darkness: being and non-being are not opposites. Non-being is prior. Non-being is generative.

Chapter 40: "All things under heaven sprang from It as existing and named; that existence sprang from It as non-existent and not named." The chain runs: from the unnamed darkness (Wu, non-being) springs being; from being springs the ten thousand things.

Chapter 4: "The Tao is like the emptiness of a vessel; and in our employment of it we must be on our guard against all fulness. How deep and unfathomable it is, as if it were the Honoured Ancestor of all things!" The vessel's usefulness is in its emptiness. A full vessel cannot receive. A full mind cannot be renewed. The darkness — the inner vacancy — is what makes transformation possible.

Zhuangzi describes the Grand Beginning (the cosmological void) with precision: "There was nothing in all the vacancy of space; there was nothing that could be named. It was in this state that there arose the first existence — the first existence, but still without bodily shape. From this things could then be produced."

The Taoist inner technology is the cultivation of emptiness in the practitioner — the deliberate creation of inner vacancy through stillness, breath, and non-grasping — so that the Tao, which is always already present, can operate without obstruction. You do not fill the darkness. You learn to inhabit it.
"""),

    ("apophatic_darkness", "The Apophatic Tradition: Where Knowledge Ends", """\
The apophatic (via negativa) current in Christian mysticism arrives at the same ground by a different route: not by cosmological reasoning but by the direct encounter of a consciousness that has exhausted all its concepts.

Pseudo-Dionysius the Areopagite (~500 CE), in The Mystical Theology, describes the darkness not as the absence of God but as the mode of God's presence beyond all attributes: "He has made Darkness His secret place." The divine is not encountered in clarity but in the failure of clarity. When every concept, image, and idea about the divine has been relinquished, what remains is not emptiness in the deficient sense — it is the fullness that cannot be named.

The Cloud of Unknowing (anonymous, 14th century) is the most practical manual for entering this state deliberately: "When I say darkness, I mean a lacking of knowing: as all that thing that thou knowest not, or else that thou hast forgotten, it is dark to thee; for thou seest it not with thy ghostly eye." The cloud is not a metaphor for confusion. It is a description of the actual phenomenology of contemplative prayer at its depths — a state where the mind's discursive operations fall silent and what remains is bare, non-conceptual awareness.

John of the Cross instructs: "It is much better to impose silence on the faculties, that God may speak. In order to attain to this state, the natural operations must cease." The cessation of natural operations — the silencing of the interpreting, naming, evaluating mind — is the active technology of entering the void. This is practiced, not waited for.

The Vijnana Bhairava Tantra (Dharana 17) offers the most precise instruction in the corpus for this state: "The Yogi should contemplate over the previous condition of any letter whatsoever before its utterance and its final condition after its utterance as mere void." The practice is to inhabit the silence before the word — the darkness before the declaration — and to recognize that silence as the ground from which all creative power moves.
"""),

    ("dark_night_passage", "The Dark Night: When Darkness Happens to You", """\
There is a second mode of darkness that the traditions document — not the void you enter deliberately, but the darkness that descends on you. This is the Dark Night of the Soul.

John of the Cross describes it with relentless precision: "This purgative and loving knowledge or Divine light acts upon the soul which it is purging and preparing for perfect union with itself, in the same way as fire acts upon a log of wood in order to transform it into itself. It drives out its unsightliness, and makes it black and dark, so that it seems worse than before and more unsightly and abominable than it was."

The log does not look like fire while the fire is doing its work. It looks charred, ruined, worse than before it met the flame. This is the essential phenomenology of the dark night: the appearance of destruction is the reality of transformation. The old form must lose its coherence — must become void — before the new form can emerge.

Al-Ghazali's Confessions documents the same passage from the Sufi side: the ten years of dissolution, the progressive stripping of every certainty, every identity, every support — until what remained was the direct experience of the Real, unmediated by conceptual overlay. This is fana in its most personal register: not a technique but an event.

The Zohar describes the cosmological version of this passage: "Afterwards the great deep arose in darkness, and darkness covered all, until light emerged and cleft the darkness and came forth and shone." Darkness is not the end of the sequence. It is the condition inside which the next light prepares itself.

The Dark Night is not a spiritual malfunction. It is the quantum collapse of a prior form — the dissolution of high-level priors so entrenched that no gentle method could release them. The REBUS model, applied here: when the brain's fixed predictions about self and world can no longer be sustained by evidence, they break down. That breakdown feels like darkness. It is actually the opening of the field.
"""),

    ("void_before_declaration", "The Silence Before the Word: Void as the Precondition of Declaration", """\
The traditions converge on a specific practical insight: declaration requires darkness. The word requires the silence it emerges from. The light requires the void it divides.

The sequence in Genesis is not accidental: void and darkness precede the first declaration. "And God said, Let there be light" does not emerge from prior light. It emerges from darkness upon the face of the deep. The creative act is the movement from the unobserved field into form. If there were already form, the declaration would have nothing to work in.

The Vijnana Bhairava Tantra Dharana 17 encodes this as a meditation practice: contemplate the void before utterance, and the void after — the silence on both sides of any word. Inhabiting that silence is not passive. It is the most concentrated form of the inner technology, because it is the direct experience of the superposed field before it collapses.

The Ascent of Mount Carmel echoes this: "Impose silence on the faculties, that God may speak." The silence is not empty waiting. It is the active condition for reception of what cannot be self-generated — the declaration that comes from a ground deeper than the conscious mind.

Habakkuk 2:20: "But the LORD is in his holy temple: let all the earth keep silence before him." The posture of creation — of receiving and then declaring what is real — begins in silence. Not the silence of having nothing to say, but the silence of a consciousness that has stopped filling the void with its own noise.

Tao Te Ching Chapter 43: "The softest thing in the world dashes against and overcomes the hardest; that which has no substantial existence enters where there is no crevice." The void — the non-substantial, the silence, the darkness — is not weak. It is the most penetrating force in the system, precisely because it has released the rigidity that blocks access to the ground.
"""),

    ("qs_application", "The QS Application: Two Modes, One Ground", """\
Quantum Strategies works with both modes of darkness: the void you enter and the dark night that happens to you.

THE VOID YOU ENTER
Before every act of declaration, there is a practice of return to the void. Not a long practice, not an elaborate ritual — but a genuine moment of inhabiting the silence before the word. This is what the VBT Dharana 17 describes. This is what the Cloud of Unknowing means by entering the cloud. You release the current form of your identity — the story you are telling, the predictions you are running — and rest, briefly, in the unobserved field where all possibilities are equally present.

From that ground, the declaration is not a hope or a wish. It is a collapse event. Consciousness, having occupied the superposed state, moves to observe — to see — the specific reality it is choosing. That observation begins to pull the probability field toward the declared form. The Hermetic axiom holds: as within, so without. The inner observation precedes the outer manifestation.

THE DARK NIGHT THAT HAPPENS TO YOU
Transformation at scale — the kind of transformation the QS process invites — will include passages through darkness that are not chosen. Old identity structures that cannot survive contact with the ground will dissolve. This dissolution is not evidence of failure. It is evidence of progress.

The instruction for this mode is different: do not try to re-establish the form that is dissolving. The fire of John of the Cross is doing the work you could not do yourself. The REBUS loosening of high-level priors is happening. Stay in the process. The darkness that covers all — as the Zohar says — is the condition inside which the next light prepares itself.

BOTH MODES, ONE MECHANISM
In the quantum frame: superposition → observation → collapse → form. In the mystical frame: void → declaration → manifestation. In the experiential frame: silence → word → reality. In the transformational frame: dissolution → recognition → new form.

The mechanism is the same at every scale. Darkness is not the problem. It is the ground. The work of Quantum Strategies is to teach practitioners to stop fleeing it and start working from it.
"""),

]


class QsDarknessVoidIngester(BaseIngester):
    tradition = "science"
    text_name = "qs_darkness_void_synthesis"
    display_name = "QS Darkness/Void Synthesis"
    source_url = None
    priority = 1

    def get_chunks(self) -> list[dict]:
        chunks = []
        for section_key, section_title, body in SECTIONS:
            content = clean_text(
                f"Quantum Strategies — Darkness & Void Synthesis\n"
                f"{section_title}\n\n{body.strip()}"
            )
            chunks.append({
                "tradition": self.tradition,
                "text_name": self.text_name,
                "author": "Quantum Strategies",
                "translator": "",
                "date_composed": "2026",
                "book": "1",
                "chapter": "darkness_void",
                "section": section_key,
                "content": content,
                "priority": self.priority,
                "content_type": "synthesis",
                "source_url": None,
                "language": "english",
                "themes": THEMES,
                "cross_tradition_tags": CROSS_TAGS,
                "metadata": {
                    "section_key": section_key,
                    "section_title": section_title,
                    "document": "qs_darkness_void_synthesis",
                },
            })
        print(f"    {len(chunks)} sections")
        return chunks
