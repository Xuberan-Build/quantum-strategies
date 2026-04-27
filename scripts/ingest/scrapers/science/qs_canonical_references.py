"""
QS Canonical References — Inner Technology & the Self-Empowerment Convergence
Quantum Strategies synthesis document.

Core thesis: inner state is the primary creative force of lived reality.
Every major tradition and modern neuroscience converge on this operative principle,
and each supplies a distinct technology for working it.
"""
from scrapers.base import BaseIngester
from chunk_utils import clean_text

THEMES = [
    "quantum_strategies", "inner_technology", "self_empowerment", "consciousness",
    "reality_creation", "mind_transformation", "neuroplasticity", "cross_tradition",
    "canonical_references", "kingdom_within", "renewing_the_mind",
]
CROSS_TAGS = [
    "transformation", "consciousness", "divine_identity", "inner_kingdom",
    "ego_dissolution", "non_duality", "stages_of_development",
]

# Each entry is (section_key, section_title, body_text)
SECTIONS = [

    ("central_claim", "The Central Claim: Inner State as Creative Ground", """\
The core claim of Quantum Strategies is not philosophical — it is operative. Your inner state is the primary creative force of your lived reality. Not a metaphor. Not an attitude. A mechanism.

This claim is not new. It is the oldest claim in human recorded wisdom. The Bible names it as the kingdom. The Hermetic tradition calls it the Principle of Mentalism. The Upanishads ground it in the identity of Atman and Brahman. The Tao Te Ching encodes it in the nature of Te. The Sufis transmit it as the secret of fana and baqa. Modern neuroscience is rediscovering it as predictive processing, prior-relaxation, and gamma coherence.

Every tradition that has lasted thousands of years is, at its functional core, a technology for working this principle. The practices differ. The mechanism is the same: change the inner ground, and what grows from it changes.

Quantum Strategies exists to make this technology practical, accessible, and evidence-grounded for people building their lives and enterprises.
"""),

    ("biblical_foundation", "The Biblical Foundation: Kingdom, Renewal, Identity", """\
The primary Western canonical anchors for this principle come from the New Testament. Three passages form the core:

"And be not conformed to this world: but be ye transformed by the renewing of your mind." (Romans 12:2, KJV)

This is not instruction about attitude or morality. It is instruction about the mechanism of transformation. The mind — specifically its patterns, its conditioning, its priors — must be renewed. Not improved. Renewed. The Greek word is anakainosis: a complete renovation of the inner structure from which perception and action arise.

"But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you." (Matthew 6:33, KJV)

The operative instruction here is the sequence: inner alignment first, outer provision second. The kingdom is not a destination. It is an inner order, a quality of consciousness from which right action flows effortlessly. Everything else is downstream of that alignment.

"Neither shall they say, Lo here! or, lo there! for, behold, the kingdom of God is within you." (Luke 17:21, KJV)

The most direct statement in the Christian canon. The kingdom — the ground of creative power, of divine order — is not external, future, or conditional. It is interior and present. The entire transformative work is a work of inner access, not outer acquisition.

Supporting this is Psalm 82:6 — "I have said, Ye are gods; and all of you are children of the most High" — which asserts that the human being is not merely subject to divine order but participates in it. The identity itself carries creative authority.
"""),

    ("hermetic_mechanism", "The Hermetic Mechanism: All Is Mind", """\
The Hermetic tradition provides the most explicit philosophical framework for the mechanism behind these Biblical instructions.

The Kybalion (1908, drawing on Hermetic tradition) opens with its first and foundational principle: "THE ALL is Mind; the Universe is Mental." This is not mystical poetry. It is the ontological claim that mind is prior to matter — that what we call physical reality is a manifestation within a field that is fundamentally mental in character.

The Corpus Hermeticum (Tractate 11, Mead translation) extends this into practice: "Conceiving nothing is impossible unto thyself, think thyself deathless and able to know all — all arts, all sciences, the way of every life. Become more lofty than all height, and lower than all depth... collect in thyself all senses of all creatures."

This is not instruction to fantasize. It is instruction to dissolve the contracted sense of self — the belief in limitation — and consciously occupy the full scope of awareness that is your actual nature. The Hermetic practitioner expands identity until it coincides with the creative ground itself.

The Emerald Tablet completes the framework with its axiom of correspondence: as above, so below; as within, so without. The inner state and the outer circumstance are not independent variables. They are correspondent reflections. Change the inner, and the outer correspondence must shift.
"""),

    ("eastern_confirmation", "The Eastern Confirmation: Atman, Te, and Vital Energy", """\
The Upanishads arrive at the same principle from the direction of direct inquiry into the nature of the self.

The Mandukya Upanishad, the most concentrated of the five core texts, opens: "Om! — All this is surely Brahman. This Self (Atman) is Brahman." The self is not a fragment of ultimate reality. The self is ultimate reality, temporarily identified with a particular body, mind, and biography. The technology of the Upanishads — meditation, self-inquiry, contemplation — is the technology of recognizing and stabilizing this identity. When you act from that identity, you act from the same ground that creates worlds.

The Tao Te Ching (Chapter 16) supplies the practice: "The state of vacancy should be brought to the utmost degree, and that of stillness guarded with unwearying vigour. All things alike go through their processes of activity, and then we see them return to their original state." Return to the root. Hold stillness. From that stillness, Te — inner virtue, the concentrated power of alignment with Tao — operates through you.

The Neiye (Inner Training, 4th century BCE) is perhaps the oldest explicit inner technology manual in human record. It documents a specific practice of cultivating jing (vital essence) and qi (vital energy) through regulated breath, emotional stability, and mental unification: "The vital energy of the people shines brightly as if ascending to heaven, is obscure as if residing in an abyss, enters as if into the sea, ends as if at its origin. Therefore this vital energy cannot be restrained by force, yet can be attracted by virtue."

The Neiye makes the mechanism explicit: inner cultivation produces a quality called shen — spirit, or clarified awareness — which then operates on outer circumstances not through force but through the natural authority of its own coherence.
"""),

    ("sufi_technology", "The Sufi Technology: Emptying to Receive", """\
The Sufi tradition contributes the most precise inner technology of self-emptying as the precondition for transformation.

Al-Ghazali, in his Confessions (~1100 CE): "I learnt from sure and certain knowledge that the Sufis are above all men of action. Their lives are good, their method is sound, their character is irreproachable... The mystic path consists in the purification of the heart from all that is not God." The technique is not addition but subtraction: removing the noise, the conditioning, the ego-patterns that occlude the inner ground.

This process has a name in Sufi practice: fana — annihilation of the conditioned self. And its fruit is baqa — subsistence in the Real. After fana comes not absence but fullness. The self that returns after ego-dissolution is not the contracted self that entered the process. It is the self that knows its own ground and acts from it.

Nicholson's documentation of Sufi illumination states: the Sufi does not seek experience for its own sake but the permanent transformation of the instrument — the human being — so that right action arises naturally, without the distortion of unexamined self-interest. This is the same as Romans 12:2 read in depth: renewal of the mind as renovation of the instrument of perception and action.
"""),

    ("inner_technologies_map", "The Inner Technologies: What the Traditions Prescribe", """\
Across all traditions, the practices converge on a recognizable set of inner technologies. These are not beliefs. They are methods.

STILLNESS AND RETURN (Taoism)
The Tao Te Ching prescribes returning to the root through stillness. The Neiye is explicit: regulated breath, emotional stability, and sustained mental unification build jing into shen. The practice is physiological as much as mental — breath is the primary lever.

CONTEMPLATION AND ATTENTION TRAINING (Christian Mysticism, Buddhism)
The Cloud of Unknowing, John of the Cross, and Teresa of Ávila all prescribe sustained, non-conceptual attention as the technology of inner transformation. Not thinking about God but resting in the ground beneath thought. The direction of attention itself is the practice.

SELF-INQUIRY AND RECOGNITION (Vedanta, Upanishads)
The Upanishadic method is inquiry: who is the one who perceives? Trace every experience back to its source. What remains when all objects of consciousness are set aside? The recognition of Atman — the witnessing awareness that was never born and never changes — is not a belief but a direct seeing. Seeing this changes the operating premise of every subsequent action.

FANA AND BAQA (Sufism)
Systematic dismantling of ego-identification, not through suppression but through sustained presence with the Real. The heart is progressively emptied of everything that is not the ground — desire, fear, opinion, image — until what remains is the mirror-quality of original nature.

ENERGY CULTIVATION (Tantra, Taoism)
The Mahanirvana Tantra and the Neiye both point to the body as a site of the work. Kundalini, qi, prana — different names for the same phenomenon: a concentrated inner energy that, when cultivated rather than dissipated, produces states of clarity, creative authority, and expanded perception.

DECLARATION AND INTENTION (Cross-tradition)
Every tradition includes a technology of intentional declaration — naming the reality you are aligning to, before evidence of it exists. The Biblical prayer of faith, the Tantric mantra, the Hermetic assumption of identity — all operate on the same principle: the inner declaration precedes and shapes the outer manifestation.
"""),

    ("science_bridge", "The Science Bridge: What Neuroscience Found", """\
Modern neuroscience has, largely without intending to, documented the mechanisms behind these ancient technologies.

GAMMA COHERENCE AND LONG-TERM PRACTICE
Lutz et al. (PNAS, 2004) measured Buddhist practitioners with an average of 34,000 hours of meditation training. During meditation, they produced self-sustained, high-amplitude gamma oscillations — 25 to 42 Hz synchronous electrical activity — at amplitudes and coherence levels never previously observed in the literature. The baseline brain state of long-term practitioners was already different from that of controls, even before meditation began. The inner technology permanently restructures the instrument.

THE REBUS MODEL: RELAXING HIGH-LEVEL PRIORS
Carhart-Harris and Friston (Pharmacological Reviews, 2019) developed the Relaxed Beliefs Under Psychedelics (REBUS) model, which proposes that the brain is fundamentally a hierarchical prediction machine. High-level priors — fixed beliefs about self, world, and possibility — suppress incoming information that doesn't fit the existing model. These priors are the neurological substrate of conditioned identity.

The model's central finding: when high-level priors are relaxed (through meditation, psychedelics, or similar interventions), the brain becomes genuinely plastic. Low-level signals can propagate upward and update the model. This is the neuroscience of "renewing your mind." The Roman 12:2 instruction is not poetic — it describes a real neurological event in which fixed top-down predictions are dissolved and the system becomes open to new patterns of perception and response.

THE DEFAULT MODE NETWORK AND SELF-REFERENTIAL PROCESSING
Brewer et al. (PNAS, 2011) found that experienced meditators show reduced activity in the default mode network during meditation — the network most associated with self-referential thought, rumination, and narrative identity. The persistent "I" that evaluates every experience through the filter of personal history goes quiet. What experienced practitioners describe as "the observer" or "the witness" corresponds to a measurable state of neural organization in which the contracted self is no longer the primary processing hub.

CONSCIOUSNESS AS FUNDAMENTAL
Penrose and Hameroff's Orchestrated Objective Reduction (Orch-OR) hypothesis proposes that consciousness involves quantum processes in neural microtubules — and that, at the quantum level, the boundary between mind and matter may not be where classical physics placed it. Whether or not Orch-OR proves correct, it signals a shift: the model of consciousness as a passive byproduct of neural computation is no longer the only serious scientific position. The possibility that consciousness is in some sense fundamental — not generated by matter but generative of it — is now a legitimate research question.
"""),

    ("qs_synthesis", "The QS Synthesis: Three Moves, One Mechanism", """\
Quantum Strategies organizes this convergence into a practical framework built on three moves, corresponding to the Three Rites.

PERCEPTION (Rite I): See clearly what is actually running.
Before transformation is possible, the existing inner structure must be made visible. The high-level priors, the conditioned identity, the fixed beliefs that filter perception — these must be seen directly. This is what the Upanishads call viveka (discrimination), what the Christian mystical tradition calls discernment, what the REBUS model calls prior-awareness. You cannot renew what you cannot see.

DECLARATION (Rite II): Declare the new ground from the inner kingdom.
Having seen the existing structure, you make a new declaration — not a wish, but a statement of the reality you are now aligned to. This is not affirmation as wishful thinking. It is the Hermetic assumption of identity, the Tantric mantra, the Biblical prayer of faith — each of which operates on the principle that a sufficiently clear inner declaration, made from the ground of genuine recognition, begins immediately to reorganize perception and action around the new premise.

ACTION (Rite III): Act in alignment with the declared ground.
The inner work must become embodied in action. This is baqa after fana — not just the experience of dissolution but the life that follows from it. It is the Neiye's "holding to unity" expressed in daily conduct. The transformation is not real until it changes what you do.

These three moves are not sequential steps performed once. They are a continuous practice — an ongoing cycle of seeing, declaring, and acting from the inner ground. The technology is the repetition. This is what renewing the mind actually looks like in practice.
"""),

]


class QsCanonicalReferencesIngester(BaseIngester):
    tradition = "science"
    text_name = "qs_canonical_references"
    display_name = "QS Canonical References"
    source_url = None
    priority = 1

    def get_chunks(self) -> list[dict]:
        chunks = []
        for section_key, section_title, body in SECTIONS:
            content = clean_text(
                f"Quantum Strategies — Canonical References\n"
                f"{section_title}\n\n{body.strip()}"
            )
            chunks.append({
                "tradition": self.tradition,
                "text_name": self.text_name,
                "author": "Quantum Strategies",
                "translator": "",
                "date_composed": "2026",
                "book": "1",
                "chapter": "canonical_references",
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
                    "document": "qs_canonical_references",
                },
            })
        print(f"    {len(chunks)} sections")
        return chunks
