"""
QS Tradition Venn Overlay — Cross-Tradition Convergence Map
Quantum Strategies synthesis document.

Purpose: answer cross-tradition questions ("what do all traditions say about X?")
with a QS interpretive frame. One section per major convergence theme. Each section
names the theme, shows how every major tradition addresses it, and draws the
practical implication for the QS practitioner.
"""
from scrapers.base import BaseIngester
from chunk_utils import clean_text

THEMES = [
    "quantum_strategies", "cross_tradition", "convergence", "ego_dissolution",
    "stages_of_development", "body_as_instrument", "right_action", "divine_love",
    "silence", "transformation", "inner_technology", "comparative_mysticism",
]
CROSS_TAGS = [
    "ego_dissolution", "stages_of_development", "transformation", "consciousness",
    "divine_union", "inner_kingdom", "transcendence", "non_duality",
]

SECTIONS = [

    ("ego_dissolution", "Ego Dissolution: Every Tradition's First Gate", """\
Of all the convergences across the mystical traditions in the QS corpus, none is more consistent than this: the contracted self — the identity built from habit, fear, and history — must be dissolved before genuine transformation can occur. Every tradition has a name for this. Every tradition has a technology for it. None treats it as optional.

SUFISM — FANA
The Sufi tradition is the most direct. Fana means annihilation — the complete dissolution of the nafs (ego-self) in the divine. Nicholson's Mystics of Islam documents the endpoint: "The eternal and the phenomenal are two complementary aspects of the One. Man is God's consciousness as revealed in creation." The individual self was never separate to begin with. Fana is the recognition of what was always true. What dissolves is the illusion of separation, not the individual — what remains after fana is baqa, subsistence in the Real.

HINDUISM — NETI NETI
The Upanishadic method is systematic negation: not this, not this. The Isa Upanishad encodes the paradox: "He who knows at the same time both knowledge and not-knowledge overcomes death through not-knowledge, and obtains immortality through knowledge." Every fixed identification with form, thought, or role is tested and released. What cannot be negated — the witnessing awareness that remains when everything else is removed — is the Atman. Ego dissolution is the process of discovering what you actually are by eliminating what you are not.

CHRISTIAN MYSTICISM — KENOSIS
John of the Cross is precise: "Make it empty of all things and blind. For the soul is not united to God by understanding or feeling or imagination, or any other sense whatever, but only by faith." The emptying must be complete. Every image of God, every consolation, every spiritual experience — if held onto — becomes an obstacle. The dark night is the divine action of stripping what the practitioner cannot voluntarily release. Teresa of Ávila maps it across the seven mansions of the Interior Castle: each room is entered only by leaving the previous one behind.

KABBALAH — BITTUL
The Zohar describes the movement: "God takes him from his original elements, separates himself from the desires which they inspire." The Kabbalistic term bittul means nullification — the dissolution of the separate will into divine will. It is not destruction of the self but the alignment of the personal with the universal. The sephirotic tree maps the stages of this descent and ascent: from Keter (crown, pure unity) through the full structure of creation and back.

TAOISM — WU WO
The Taoist equivalent is wu wo — no-self, or the absence of self-assertion. The sage of the Tao Te Ching acts without imposing a personal agenda on events. The Neiye describes the cultivation required: emotional stability, breath regulation, and the progressive quieting of the reactive patterns that constitute conditioned identity. The result is not passivity but the effortless action that flows when the personal will stops obstructing the Tao.

THE QS FRAME
Ego dissolution is the precondition for the Declaration Rite, not a spiritual achievement reserved for advanced practitioners. You cannot install a new identity over a defended one. The old frame must release — at least provisionally, at least enough — before the new declaration has room to take. This is why the Perception Rite comes first: seeing the current identity structure clearly is the beginning of its dissolution. You do not fight the ego. You see through it. Seeing through it is already the beginning of fana.
"""),

    ("stages_of_development", "Stages of Development: Transformation Has a Sequence", """\
Every tradition that has produced lasting transformation technology agrees on a second principle: the path has stages, the stages have an order, and the order cannot be reversed. You cannot access the later stages without passing through the earlier ones. This is not a moral hierarchy — it is a description of how the nervous system, the psyche, and the soul actually develop.

SUFISM — MAQAMAT
The Sufi maqamat (stations) are the most systematically documented stages in the corpus. Nicholson's Mystics of Islam opens Chapter 1 with the principle: "Mystics of every race and creed have described the progress of the spiritual life as a journey or a pilgrimage." The Sufi path moves through tawba (repentance — the turning away from the contracted self), zuhd (renunciation), sabr (patient endurance), tawakkul (trust), and rida (acceptance) — each a stable state that must be inhabited before the next can be entered. The sheikh's role is to hold the map and prevent the student from skipping stages.

CHRISTIAN MYSTICISM — PURGATION, ILLUMINATION, UNION
John of the Cross structures the path in three movements that operate on both the sensory and spiritual levels: purgation (the stripping of attachments and false supports), illumination (the infusion of divine light, often preceded by the dark night), and union (the transformation of the soul into the divine life). The Ascent of Mount Carmel documents the sequential requirements: "Cast away the strange gods, self-purification, the changing of garments." Each phase prepares the ground for the next. The soul that has not been purged cannot sustain illumination. The soul that has not been illuminated cannot bear union.

KABBALAH — THE SEPHIROT
The Tree of Life maps ten sephirot as progressive emanations from Keter (pure undifferentiated being) through Chokhmah (wisdom), Binah (understanding), and down through the structure of creation to Malkuth (kingdom — the manifest world). The Zohar states: "The Tree of Life extends over five hundred years' journey, and all the waters of Creation issue from its foot." This is not merely cosmology. It is a map of the stages through which consciousness descends into form and must re-ascend. Each sephirah is a developmental stage with its own qualities, challenges, and integrations.

TAOISM — THE RETURN
The Tao Te Ching structures development as a spiral: from the undifferentiated Tao, through the ten thousand things, back to the root. Chapter 16: "All things alike go through their processes of activity, and then we see them return to their original state." The Neiye documents the cultivation sequence: first regulate the body through breath and posture, then stabilize emotion, then unify the mind, then allow shen (spirit) to arise naturally from the coherence of the lower levels. Each level depends on the previous.

NEUROSCIENCE — DEVELOPMENTAL HIERARCHY
The REBUS model's hierarchical predictive processing structure confirms this architecturally: high-level priors can only be updated after lower-level stability is established. Trauma-conditioned priors in the nervous system will reassert themselves over any higher-level intention until the lower level is addressed. Development cannot be willed from the top down. The sequence has a physiological basis.

THE QS FRAME
The Three Rites encode the minimal developmental sequence: Perception (purgation — see what is actually running), Declaration (illumination — install the new ground), Action (union — embody it until the new pattern is more stable than the old). These are not steps performed once. They are recursive. Each cycle goes deeper. The practitioner who returns to Perception after completing a cycle of Action will see more than they could before. The sequence is a spiral, not a line.
"""),

    ("body_as_instrument", "The Body as Instrument: Transformation Must Be Embodied", """\
A third convergence: every tradition that produces lasting transformation treats the body not as an obstacle to spirit but as its primary instrument. The body is the place where the inner work becomes real. Transformation that does not reach the body does not last.

TANTRA — THE SUBTLE BODY
The Tantric traditions offer the most detailed maps of the body as transformative instrument. The Mahanirvana Tantra describes the Kundalini energy coiled at the Muladhara chakra at the base of the spine, which — through specific practices involving breath (pranayama), gesture (mudra), sound (mantra), and visualization — is activated and drawn upward through the Sushumna Nadi to the crown, producing progressive states of liberation. The Vijñana Bhairava Tantra offers 112 specific dharanas — body-based practices that use sensation, breath, and spatial awareness as direct portals to altered states of consciousness. The body is the instrument; the practices are the playing technique.

TAOISM — QI AND THE NEIYE
The Neiye is explicit: vital energy (qi) is cultivated through the body before it produces transformation in consciousness. Section 1: "The vital energy of the people shines brightly as if ascending to heaven, is obscure as if residing in an abyss — stored within the chest, they are called sages." The energy that produces wisdom is the same energy that animates the body. Regulate the breath, stabilize the posture, moderate eating — these physical disciplines precede and enable the mental and spiritual ones. The Taoist tradition understands that you cannot skip the body and access the spirit.

HERMETICISM — PNEUMA
The Corpus Hermeticum (Tractate 14) addresses the body through the concept of pneuma — the divine breath or spirit that animates matter. "Spirit and Matter are practically regarded as the Positive and Negative" — they are not opposed but complementary poles of a single system. The Hermetic practitioner works with both. The body is not fallen matter to be transcended; it is the densest expression of the same Logos that pervades all levels of creation.

CHRISTIAN — THE TEMPLE
Paul's first letter to the Corinthians states it directly: "Know ye not that ye are the temple of God, and that the Spirit of God dwelleth in you?" The body is not a prison for the soul. It is the dwelling place of the divine. Meister Eckhart extends this: "Soul is contained in a place betwixt time and eternity, touching them both." The body is the point of contact between the temporal and the eternal. Spiritual transformation that ignores the body ignores the very site of its operation.

NLP — SOMATIC ANCHORING
The NLP principle of somatic anchoring confirms this from the technical side: the body encodes state more reliably than language. A posture, a breath pattern, a physical gesture — these are the most stable and accessible anchors precisely because they cannot be argued with by the conscious mind. This is why embodied practice across all traditions — yoga, prostrations, walking meditation, ritual movement — is not decoration. It is the most durable form of programming the transformation makes available.

THE QS FRAME
The work does not end in the mind. A declaration that remains only in thought has not landed. The body must know it. This is why the Action Rite is not just behavioral — it is physiological. New posture. New breath pattern. New way of inhabiting space. The practitioner who has dissolved the old ego-frame and declared a new one must then teach the body to act from that new frame under conditions of pressure. The body is the last to update and the first to revert. Getting it all the way into the body is the completion of the rite.
"""),

    ("right_action", "Right Action: What You Do When You Act From the Ground", """\
A fourth convergence: once the ego has dissolved into alignment with the larger ground, action changes in character. It is no longer effortful in the same way. It no longer requires continuous vigilance against self-interest. It arises naturally, appropriately, with a quality of precision and ease that striving cannot produce. Every tradition names this quality. Every tradition treats it as the fruit of the preceding work, not a technique to be learned directly.

TAOISM — WU WEI
Wu wei is the most concentrated expression of this principle in the corpus. The Tao Te Ching Chapter 37: "The Tao in its regular course does nothing for the sake of doing it, and so there is nothing which it does not do. If princes and kings were able to maintain it, all things would of themselves be transformed by them." Wu wei is not passivity or absence of action. It is action so precisely aligned with the Tao that it produces no friction, generates no residue, and accomplishes everything without the appearance of effort. Chapter 43: "There are few in the world who attain to the teaching without words, and the advantage arising from non-action." The advantage is real. The rarity is real.

HINDUISM — KARMA YOGA
The Bhagavad Gita presents karma yoga — the yoga of action — as the path for those who must act in the world. Krishna's instruction to Arjuna: "Who doeth work rightful to do, not seeking gain from work, that man is Sanyasi and Yogi both in one." Action performed without attachment to outcome, without the ego's investment in a particular result, is karma yoga. The action itself is complete. The fruit belongs to the ground, not the actor. This is not indifference — it is the freedom that comes when the self is no longer using action to confirm its own existence.

SUFISM — BAQA AND TAWAKKUL
After fana comes baqa — subsistence in the Real. The Sufi in baqa does not stop acting; they act from a different source. The Mystics of Islam describes the state of tawakkul (complete trust in God) at its extreme: "total passivity like that of a corpse in the hands of the washer" — but this is the description of the interior disposition, not the exterior behavior. The Sufi in this state acts with complete engagement and complete non-attachment simultaneously. The action is God's action flowing through a cleared instrument.

KABBALAH — TIKKUN
The Kabbalistic concept of tikkun olam — repair of the world — grounds right action in the largest possible frame. The Zohar: "In every generation the world was held together by the letters." The acts of individuals who have aligned themselves with the divine will contribute to the ongoing repair and completion of creation. Right action, in this frame, is cosmologically significant. It is not merely personally beneficial or socially good. It participates in the divine project.

THE QS FRAME
Right action is the output of the Three Rites completed. When perception is clear (the map is accurate), the declaration is grounded (the new identity is installed in the void), and the body has been brought into alignment, action changes. The practitioner stops asking "what should I do" and starts noticing what is already arising from the aligned ground. This is not mystical — it is the natural result of having cleared the filters. The Tao flows through the vessel that is not blocking it. Wu wei is not a technique. It is what remains when technique has done its work and been released.
"""),

    ("love_as_force", "Love as Transformative Force: The Engine Beneath Everything", """\
Every tradition in the corpus, when pressed to its depths, arrives at love — not as sentiment or emotion, but as the fundamental force of transformation. Love is what moves the practitioner through the difficult passages. Love is what fana empties the self toward. Love is what the declaration ultimately aligns with. Without it, the technology is cold machinery producing nothing.

SUFISM — MAHABBAH
The Sufis are the tradition most explicitly organized around divine love as path. Nicholson documents the core Sufi claim: love (mahabbah) produces states that intellect cannot reach — "transport and rapture in loving Him as deprived those enamoured men of their reason, and made them unconscious of themselves." This unconsciousness is not pathology. It is fana in its most complete form: the lover so absorbed in the beloved that the separate self falls away. Rumi's Masnavi encodes it in every story. The lover who reads sonnets to his beloved instead of simply being present with her — praising her in language while missing the actual encounter — is the portrait of a practitioner who has learned the vocabulary of transformation without crossing into the experience.

CHRISTIAN MYSTICISM — AGAPE
Meister Eckhart describes love as the mechanism of divine action in the soul: "God comes in love with intent that the soul may arise, that in love she may energise above herself. For love cannot be without finding her like or making alike." Love is what God uses to raise the soul beyond its own capacity. It is not reward for spiritual achievement. It is the means. The soul that opens to love is acted upon by a force beyond its own resources. Eckhart extends it: "A man might live a thousand years and go on growing all the time in love, just as fire will burn so long as there is wood." Love does not reach a ceiling. It is the unlimited fuel of transformation.

TANTRA — BHAKTI
The Vijñana Bhairava Tantra (Dharana 98) points to bhakti — devotional love — as producing a specific kind of direct knowing: "The sort of intuition that emerges through the intensity of devotion in one who is perfectly detached." This is not the love that clings. It is the love that has been purified of personal agenda — detached in the sense of non-grasping, intense in the sense of total engagement. The Tantric tradition understands that devotion and emptiness are not opposites. Love without ego-investment is the most concentrated form of both.

KABBALAH — CHESED
Chesed — loving-kindness — is the fourth sephirah on the Tree of Life, the first of the attributes below the supernal triad. It is the downward flow of divine generosity into creation. In the Kabbalistic understanding, the universe is sustained by ongoing love — the continuous emanation of divine attention into form. The practitioner who aligns with Chesed participates in this downward flow, becoming a conduit for it in the world.

THE QS FRAME
Love is not the emotional decoration of the work. It is the motivational ground without which the work does not sustain. The practitioner who approaches transformation purely as a technical project — ego to be dissolved, priors to be loosened, identity to be declared — will find the work eventually exhausting. The practitioner who does it because they love something — love their life, love their potential, love the people their transformation will serve — has access to a fuel that the technical frame cannot produce. Every tradition that has produced genuine transformation sustained over a lifetime is organized around love of some kind. This is not accidental. Love is the force that keeps the practitioner moving through the difficult passages when technique alone would have them quit.
"""),

    ("silence_as_ground", "Silence: Where Every Tradition Goes to Listen", """\
The sixth convergence is the most subtle and the most universal. Every tradition, at its deepest practice level, arrives at silence — not the absence of sound but the cessation of the internal commentary, the reactive mind, the constant interpretation of experience. In that silence, something else becomes available. Every tradition describes what is available differently. Every tradition agrees that silence is the access condition.

TAOISM — STILLNESS
The Tao Te Ching encodes the practice in Chapter 45: "Constant action overcomes cold; being still overcomes heat. Purity and stillness give the correct law to all under heaven." Stillness is not inactivity — it is the state in which the noise of the conditioned mind quiets enough for the natural order (Tao) to become perceptible. Chapter 16 makes it prescriptive: "The state of vacancy should be brought to the utmost degree, and that of stillness guarded with unwearying vigour." Stillness is not a byproduct. It is a practice. It requires cultivation and protection.

TANTRA — SAMADHI AND SHUNYA
The Kularnava Tantra distinguishes two levels: gross meditation (upon a form) and subtle meditation (without any formal object). "The Gross kind of Meditation is resorted to for the steadiness of mind. The mind becomes steady by the Gross Meditation." But the subtle — formless absorption — is what the Mahanirvana Tantra calls Shunyadhyana: meditation on the void, "beyond the scope of mind and speech." The Vijñana Bhairava Tantra Dharana 20 gives the practice directly: "If in one's body, one contemplates over shunya (spatial vacuity) in all directions simultaneously without any thought-construct, he experiences vacuity all round and is identified with it." This is samadhi — the state in which the practitioner and the ground are no longer distinct.

CHRISTIAN MYSTICISM — INTERIOR SILENCE
Meister Eckhart describes what becomes available in deep silence: "Deaf to all the world, in silence and in peace... God on a sudden declares himself to the soul, plighting her his troth for good and all. It is the Father begetting the Son in the soul." The declaration does not come from the practitioner's effort. It arrives in the silence the practitioner creates. John of the Cross: "It is much better to impose silence on the faculties, that God may speak." The active silencing of the interpretive mind is the technique. What happens in that silence is beyond technique.

SUFISM — DHIKR AND SUKOON
The Sufi path uses both sound (dhikr — remembrance through repetitive chanting of divine names) and its opposite — the silence that dhikr prepares. The rhythm of sacred repetition induces a state of inner stillness deeper than what effortful quietude can produce. The sound becomes the carrier frequency for the silence beneath it. Nicholson documents the progression: the Sufi moves from the external practices of the early path to the interior silence of the more advanced stations, where the remembrance becomes continuous and wordless.

SCIENCE — DEFAULT MODE SUPPRESSION
The Brewer et al. (PNAS 2011) DMN study finds that experienced meditators show reduced activity in the default mode network during meditation — the network most associated with self-referential thought, mind-wandering, and narrative identity. The internal commentary quiets. What remains is what the traditions are pointing toward: awareness without an object, attention without a story about what the attention means. This is the neuroscience of silence.

THE QS FRAME
Silence is both a practice (something you cultivate) and a state (something you inhabit). As a practice, it is the deliberate quieting of the interpretive mind — creating the inner condition in which the declaration can land, in which the next right action can be perceived clearly without the noise of self-interest distorting it. As a state, it is the ground from which all three rites operate most cleanly. Perception is clearest in silence. Declaration is strongest from silence. Action that arises from silence has the quality of wu wei — not forced, not effortful, not generated by the ego trying to produce a result. The practitioner who can return to silence quickly, under pressure, in the middle of a difficult situation, has access to a resource that cannot be taken away.
"""),

]


class QsTraditionVennIngester(BaseIngester):
    tradition = "science"
    text_name = "qs_tradition_venn_overlay"
    display_name = "QS Tradition Venn Overlay"
    source_url = None
    priority = 1

    def get_chunks(self) -> list[dict]:
        chunks = []
        for section_key, section_title, body in SECTIONS:
            content = clean_text(
                f"Quantum Strategies — Tradition Venn Overlay: Cross-Tradition Convergence\n"
                f"{section_title}\n\n{body.strip()}"
            )
            chunks.append({
                "tradition": self.tradition,
                "text_name": self.text_name,
                "author": "Quantum Strategies",
                "translator": "",
                "date_composed": "2026",
                "book": "1",
                "chapter": "tradition_venn",
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
                    "document": "qs_tradition_venn_overlay",
                    "traditions_covered": [
                        "taoism", "sufism", "christian_mysticism", "kabbalah",
                        "hinduism", "tantra", "hermeticism", "science",
                    ],
                },
            })
        print(f"    {len(chunks)} sections")
        return chunks
