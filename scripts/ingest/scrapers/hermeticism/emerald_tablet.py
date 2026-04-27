"""
The Emerald Tablet (Tabula Smaragdina) — attributed to Hermes Trismegistus
~8th century CE Arabic, via Latin transmission.
Hardcoded — text is ~12 lines, no HTTP fetch needed.
Three chunks: Newton's translation (1680), older Latin/Holmyard version, context.
All translations are public domain.
"""
from scrapers.base import BaseIngester

THEMES = [
    "hermeticism", "emerald_tablet", "as_above_so_below", "prima_materia",
    "transmutation", "alchemical_philosophy", "hermes_trismegistus",
    "macrocosm_microcosm", "one_thing", "solar_lunar",
]
CROSS_TAGS = [
    "transformation", "divine_union", "consciousness", "transcendence",
    "unity_of_opposites",
]

SOURCE = "https://archive.org/details/NewtonTranslationEmeraldTablet"

# Isaac Newton's translation (~1680), first published in his alchemical manuscripts
NEWTON_TEXT = """\
The Emerald Tablet — Isaac Newton Translation (~1680)

Tis true without lying, certain and most true. That which is below is like that \
which is above, and that which is above is like that which is below, to do the \
miracles of one only thing. And as all things have been and arose from one by the \
mediation of one, so all things have their birth from this one thing by adaptation.

The Sun is its father, the Moon its mother, the Wind hath carried it in its belly, \
the Earth is its nurse. The father of all perfection in the whole world is here. \
Its force or power is entire if it be converted into Earth. Separate thou the Earth \
from the Fire, the subtle from the gross, sweetly with great industry.

It ascends from the Earth to the Heaven and again it descends to the Earth and \
receives the force of things superior and inferior. By this means ye shall have the \
glory of the whole world and thereby all obscurity shall fly from you.

Its force is above all force, for it vanquishes every subtle thing and penetrates \
every solid thing. So was the world created. From this are and do come admirable \
adaptations, whereof the means (or process) is here in this. Hence I am called \
Hermes Trismegistus, having the three parts of the philosophy of the whole world. \
That which I have said of the operation of the Sun is accomplished and ended.\
"""

# Older Latin version, based on the Arabic via Pseudo-Apollonius (Kitab al-Asrar)
# Translated/reconstructed by E.J. Holmyard (1923) and the standard medieval Latin
HOLMYARD_TEXT = """\
The Emerald Tablet — Latin/Holmyard Version (~800 CE Latin, via Arabic ~650 CE)

It is true, without falsehood, certain and most true. What is above is like what \
is below, and what is below is like what is above, for the performance of the \
miracles of the One Thing. And as all things were from One, by the mediation of \
One, so all things were born of this one thing, by adaptation.

Its father is the Sun, its mother is the Moon, the Wind carried it in its womb, \
and its nurse is the Earth. The father of all the perfection of the whole world is \
here. Its power is integral, if it is turned toward Earth.

Thou shalt separate the Earth from the Fire, the Subtle from the Gross, gently \
and with great ingenuity. It rises from Earth to Heaven, and descends again to \
Earth, and receives the power of the superiors and the inferiors.

Thus thou wilt have the glory of the whole world, and all obscurity will flee from \
thee. This is the strong power of all power, for it will overcome every subtle \
thing and penetrate every solid thing. Thus the world was created. Hence were \
wonderful adaptations of which this is the means. Therefore am I called Thrice \
Great Hermes, having the three parts of the philosophy of the whole world.

That which I have to say about the operation of the Sun is complete.\
"""

# Context chunk: significance and hermetic doctrine
CONTEXT_TEXT = """\
The Emerald Tablet — Doctrine and Significance

The Emerald Tablet (Tabula Smaragdina) is the foundational text of Western alchemy \
and Hermetic philosophy. First appearing in Arabic as part of the Kitab Sirr \
al-Khalika (Book of the Secret of Creation, attributed to Balinas/Pseudo-Apollonius, \
~650 CE), it entered Latin Europe through translations around 1140 CE.

The central axiom — "That which is below is like that which is above, and that \
which is above is like that which is below" — establishes the Hermetic principle \
of correspondence: the macrocosm (universe, heaven) and microcosm (human being, \
earth) mirror each other. This becomes the foundation for:

1. Alchemy: the transmutation of base metals into gold mirrors the spiritual \
purification of the soul.

2. Astrology: celestial configurations reflect and influence terrestrial events.

3. Theurgy: ritual operations on the lower plane can affect the higher plane and \
vice versa.

The "One Thing" (Latin: unum) from which all things arise is identified variously \
with prima materia (primordial matter), the Anima Mundi (World Soul), or the \
divine Logos. The tablet's closing line — "I am Hermes Trismegistus, having the \
three parts of the philosophy of the whole world" — refers to alchemy, astrology, \
and theurgy as the three branches of Hermetic science.

Isaac Newton's private translation (c. 1680, unpublished until the 20th century) \
demonstrates the depth of engagement with alchemical Hermeticism among the founders \
of modern science. Newton wrote over a million words on alchemy and considered the \
Emerald Tablet central to understanding the laws of nature.\
"""


class EmeraldTabletIngester(BaseIngester):
    tradition = "hermeticism"
    text_name = "emerald_tablet"
    display_name = "The Emerald Tablet"
    source_url = "https://archive.org/details/NewtonTranslationEmeraldTablet"

    def get_chunks(self) -> list[dict]:
        chunks = []

        sections = [
            ("newton_translation", "1", NEWTON_TEXT, 1),
            ("latin_holmyard_version", "2", HOLMYARD_TEXT, 1),
            ("doctrine_and_significance", "3", CONTEXT_TEXT, 2),
        ]

        for section_key, chapter, text, priority in sections:
            chunks.append({
                "tradition": self.tradition,
                "text_name": self.text_name,
                "author": "Hermes Trismegistus (attributed)",
                "translator": "Isaac Newton / E.J. Holmyard",
                "date_composed": "~650 CE (Arabic); ~1140 CE (Latin)",
                "book": "1",
                "chapter": chapter,
                "section": section_key,
                "content": text,
                "priority": priority,
                "content_type": "primary_canon",
                "source_url": self.source_url,
                "language": "english",
                "themes": THEMES,
                "cross_tradition_tags": CROSS_TAGS,
                "metadata": {"section": section_key},
            })

        return chunks
