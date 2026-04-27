"""
Quran — Curated Passages (Marmaduke Pickthall translation, 1930 — public domain)
Thematically organized for Quantum Strategies RAG:
  tawhid/divine unity, divine nearness, light, the creative word,
  love, remembrance/stillness, return/death, human as khalifa,
  the breath of God, signs & reflection, transformation, the hidden.
These are the ayat the Sufi corpus (Rumi, Ibn Arabi, Ghazali, Attar)
constantly references and builds upon.
"""
from scrapers.base import BaseIngester

THEMES = [
    "quran", "islam", "tawhid", "divine_unity", "sufism",
    "divine_nearness", "light_verse", "kun_fayakun", "dhikr",
    "sacred_scripture",
]
CROSS_TAGS = [
    "divine_union", "consciousness", "transformation", "transcendence",
    "ego_dissolution", "emptiness_void", "stages_of_development",
]

# (theme_label, surah:ayat reference, text — Pickthall translation)
PASSAGES = [

    # ── TAWHID / DIVINE UNITY ────────────────────────────────────────────────

    ("Tawhid — He Is One",
     "Surah Al-Ikhlas 112:1–4",
     "Say: He is Allah, One! Allah, the eternally Besought of all! "
     "He begetteth not nor was begotten. And there is none comparable unto Him."),

    ("Tawhid — The Throne Verse",
     "Surah Al-Baqarah 2:255",
     "Allah! There is no God save Him, the Alive, the Eternal. Neither slumber "
     "nor sleep overtaketh Him. Unto Him belongeth whatsoever is in the heavens "
     "and whatsoever is in the earth. Who is he that intercedeth with Him save "
     "by His leave? He knoweth that which is in front of them and that which is "
     "behind them, while they encompass nothing of His knowledge save what He "
     "will. His throne includeth the heavens and the earth, and He is never "
     "weary of preserving them. He is the Sublime, the Tremendous."),

    ("Tawhid — The First, the Last, the Outward, the Inward",
     "Surah Al-Hadid 57:3",
     "He is the First and the Last, and the Outward and the Inward; and He is "
     "Knower of all things."),

    ("Tawhid — He Is with You Wheresoever Ye Are",
     "Surah Al-Hadid 57:4",
     "He it is Who created the heavens and the earth in six Days; then He "
     "mounted the Throne. He knoweth all that entereth the earth and all that "
     "emergeth therefrom and all that cometh down from the sky and all that "
     "ascendeth therein; and He is with you wheresoever ye may be. And Allah "
     "is Seer of what ye do."),

    ("Tawhid — The Names of God",
     "Surah Al-Hashr 59:22–24",
     "He is Allah, than Whom there is no other God, the Knower of the Invisible "
     "and the Visible. He is the Beneficent, the Merciful. He is Allah, than "
     "Whom there is no other God, the Sovereign Lord, the Holy One, Peace, the "
     "Keeper of Faith, the Guardian, the Majestic, the Compeller, the "
     "Superb. Glorified be Allah from all that they ascribe as partner (unto "
     "Him). He is Allah, the Creator, the Shaper out of naught, the Fashioner. "
     "His are the most beautiful names. All that is in the heavens and the "
     "earth glorifieth Him, and He is the Mighty, the Wise."),

    # ── DIVINE NEARNESS ───────────────────────────────────────────────────────

    ("Divine Nearness — Closer Than Your Jugular Vein",
     "Surah Qaf 50:16",
     "We verily created man and We know what his soul whispereth to him, and We "
     "are nearer to him than his jugular vein."),

    ("Divine Nearness — I Answer the Prayer of the Suppliant",
     "Surah Al-Baqarah 2:186",
     "And when My servants question thee concerning Me, then surely I am nigh. "
     "I answer the prayer of the suppliant when he crieth unto Me. So let them "
     "hear My call and let them trust in Me, in order that they may be led "
     "aright."),

    ("Divine Nearness — Whithersoever Ye Turn, There Is God's Face",
     "Surah Al-Baqarah 2:115",
     "Unto Allah belong the East and the West, and whithersoever ye turn, there "
     "is Allah's Countenance. Lo! Allah is All-Embracing, All-Knowing."),

    ("Divine Nearness — He Was with Them",
     "Surah Al-Mujadila 58:7",
     "Hast thou not seen that Allah knoweth all that is in the heavens and all "
     "that is in the earth? There is no secret conference of three but He is "
     "their fourth, nor of five but He is their sixth, nor of less than that or "
     "more but He is with them wheresoever they may be; and afterward, on the "
     "Day of Resurrection, He will inform them of what they did. Lo! Allah is "
     "Knower of all things."),

    ("Divine Nearness — We Are Nearer Unto Him",
     "Surah Al-Waqi'ah 56:83–87",
     "Why, then, when (the soul) cometh up to the throat (of the dying) and ye "
     "are at that moment looking, though We are nearer unto him than ye are, but "
     "ye see not. Then, if ye are not in bondage (unto Us), reflect it back, if "
     "ye are truthful?"),

    # ── THE LIGHT VERSE ───────────────────────────────────────────────────────

    ("Light — God Is the Light of the Heavens and the Earth",
     "Surah An-Nur 24:35",
     "Allah is the Light of the heavens and the earth. The similitude of His "
     "light is as a niche wherein is a lamp. The lamp is in a glass. The glass "
     "is as it were a shining star. (This lamp is) kindled from a blessed tree, "
     "an olive neither of the East nor of the West, whose oil would almost glow "
     "forth (of itself) though no fire touched it. Light upon light. Allah "
     "guideth unto His light whom He will. And Allah speaketh to mankind in "
     "allegories, for Allah is Knower of all things."),

    ("Light — Raised unto Life and Given Light",
     "Surah Al-An'am 6:122",
     "Is he who was dead and We have raised him unto life, and set for him a "
     "light wherein he walketh among men, as him whose similitude is in utter "
     "darkness whence he cannot emerge? Thus is their conduct made fair-seeming "
     "for the disbelievers."),

    ("Light — Their Light Running Before Them",
     "Surah Al-Hadid 57:12",
     "On the day when thou (Muhammad) wilt see the believers, men and women, "
     "their light shining forth before them and on their right hands, (and wilt "
     "hear it said unto them): Glad news for you this day: Gardens underneath "
     "which rivers flow, wherein ye are immortal. That is the supreme triumph."),

    ("Light — From Darkness unto Light",
     "Surah Al-Baqarah 2:257",
     "Allah is the Protecting Guardian of those who believe. He bringeth them "
     "out of darkness into light. As for those who disbelieve, their patrons "
     "are false deities. They bring them out of light into darkness. Such are "
     "rightful owners of the Fire. They will abide therein."),

    # ── THE WORD / KUN FAYAKUN ───────────────────────────────────────────────

    ("The Word — Be! and It Is",
     "Surah Ya-Sin 36:82–83",
     "But His command, when He intendeth a thing, is only that He saith unto "
     "it: Be! and it is. Therefore glory be to Him in Whose hand is the "
     "dominion over all things! Unto Him ye will be brought back."),

    ("The Word — He Createth What He Will",
     "Surah Al-Imran 3:47",
     "She said: My Lord! How can I have a child when no mortal hath touched me? "
     "He said: So (it will be). Allah createth what He will. If He decreeth a "
     "thing, He saith unto it only: Be! and it is."),

    ("The Word — The Pen and the Decree",
     "Surah Al-Qamar 54:49–50",
     "Lo! We have created every thing by measure. And Our commandment is but "
     "one (commandment), as the twinkling of an eye."),

    ("The Word — He Taught the Names",
     "Surah Al-Baqarah 2:31–33",
     "And He taught Adam all the names, then showed them to the angels, saying: "
     "Inform Me of the names of these, if ye are truthful. They said: Be "
     "glorified! We have no knowledge saving that which Thou hast taught us. "
     "Lo! Thou, only Thou, art the Knower, the Wise. He said: O Adam! Inform "
     "them of their names, and when he had informed them of their names, He "
     "said: Did I not tell you that I know the secret of the heavens and the "
     "earth? And I know that which ye disclose and which ye hide."),

    # ── DIVINE LOVE ───────────────────────────────────────────────────────────

    ("Love — He Loves Them and They Love Him",
     "Surah Al-Ma'idah 5:54",
     "O ye who believe, whoso of you becometh a renegade from his religion, "
     "(know that in his stead) Allah will bring a people whom He loveth and who "
     "love Him, humble toward believers, stern toward disbelievers, striving in "
     "the way of Allah, and fearing not the blame of any blamer. Such is the "
     "grace of Allah which He giveth unto whom He will. Allah is All-Embracing, "
     "All-Knowing."),

    ("Love — The Loving",
     "Surah Al-Buruj 85:13–16",
     "Lo! He it is Who produceth, then reproduceth. And He is the Forgiving, "
     "the Loving, Lord of the Throne of Glory, Doer of what He will."),

    ("Love — My Mercy Embraceth All Things",
     "Surah Al-A'raf 7:156",
     "My punishment: I strike with it whom I will, and My mercy embraceth all "
     "things, therefore I shall ordain it for those who ward off (evil) and pay "
     "the poor-due, and those who believe Our revelations."),

    ("Love — Closer to You Than Your Own Heart",
     "Surah Al-Anfal 8:24",
     "O ye who believe! Give your response to Allah and His Messenger, when He "
     "calleth you to that which will give you life; and know that Allah cometh "
     "in between a man and his heart, and that it is He unto Whom ye will be "
     "gathered."),

    # ── REMEMBRANCE AND STILLNESS ─────────────────────────────────────────────

    ("Remembrance — In Remembrance of God Do Hearts Find Rest",
     "Surah Ar-Ra'd 13:28",
     "Who have believed and whose hearts have rest in the remembrance of Allah. "
     "Verily in the remembrance of Allah do hearts find rest!"),

    ("Remembrance — Remember Me and I Will Remember You",
     "Surah Al-Baqarah 2:152",
     "Therefore remember Me, I will remember you. Give thanks to Me, and reject "
     "not Me."),

    ("Remembrance — Remember God Standing Sitting Reclining",
     "Surah Al-Imran 3:190–191",
     "Lo! in the creation of the heavens and the earth and (in) the difference "
     "of night and day are tokens (of His Sovereignty) for men of understanding, "
     "Such as remember Allah, standing, sitting, and reclining, and consider "
     "the creation of the heavens and the earth, (and say): Our Lord! Thou "
     "createdst not this in vain. Glory be to Thee! Preserve us from the doom "
     "of Fire."),

    ("Remembrance — Glorify Him Early and Late",
     "Surah Al-Ahzab 33:41–43",
     "O ye who believe! Remember Allah with much remembrance. And glorify Him "
     "early and late. He it is Who blesseth you, and His angels (bless you), "
     "that He may bring you forth from darkness unto light; and He is ever "
     "Merciful to the believers."),

    ("Remembrance — Recite in the Name of Thy Lord",
     "Surah Al-Alaq 96:1–5",
     "Read: In the name of thy Lord Who createth. Createth man from a clot. "
     "Read: And thy Lord is the Most Bounteous, Who teacheth by the pen, "
     "Teacheth man that which he knew not."),

    # ── HUMAN AS KHALIFA / DIVINE BREATH ─────────────────────────────────────

    ("Khalifa — I Am Placing a Viceroy in the Earth",
     "Surah Al-Baqarah 2:30",
     "And when thy Lord said unto the angels: Lo! I am about to place a viceroy "
     "in the earth, they said: Wilt thou place therein one who will do harm "
     "therein and will shed blood, while we, we hymn Thy praise and sanctify "
     "Thee? He said: Surely I know that which ye know not."),

    ("Khalifa — We Breathed Into Him of Our Spirit",
     "Surah Al-Hijr 15:28–29",
     "And (remember) when thy Lord said unto the angels: Lo! I am creating a "
     "mortal out of potter's clay of black mud altered. So, when I have made "
     "him and have breathed into him of My Spirit, do ye fall down, prostrating "
     "yourselves unto him."),

    ("Khalifa — He Breathed Into Him of His Spirit",
     "Surah As-Sajdah 32:7–9",
     "Who made all things good which He created, and He began the creation of "
     "man from clay; Then He made his seed from a draught of despised fluid; "
     "Then He fashioned him and breathed into him of His Spirit; and appointed "
     "for you hearing and sight and hearts. Small thanks give ye!"),

    ("Khalifa — We Have Honoured the Children of Adam",
     "Surah Al-Isra 17:70",
     "Verily We have honoured the children of Adam. We carry them on the land "
     "and the sea, and have made provision of good things for them, and have "
     "preferred them above many of those whom We created with a marked "
     "preferment."),

    # ── RETURN / EGO DISSOLUTION / FANA ─────────────────────────────────────

    ("Return — To God We Return",
     "Surah Al-Baqarah 2:155–157",
     "And surely We shall try you with something of fear and hunger, and loss "
     "of wealth and lives and crops; but give glad tidings to the steadfast, "
     "Who say, when a misfortune striketh them: Lo! we are Allah's and lo! unto "
     "Him we are returning. Such are they on whom are blessings from their Lord "
     "and mercy. Such are the rightly guided."),

    ("Return — Everything Perishes Save His Face",
     "Surah Al-Qasas 28:88",
     "Invoke not any other god along with Allah. There is no God save Him. "
     "Everything will perish save His Countenance. His is the command, and unto "
     "Him ye will be brought back."),

    ("Return — All That Is Thereon Will Pass Away",
     "Surah Ar-Rahman 55:26–28",
     "Everyone that is thereon will pass away; There remaineth but the "
     "Countenance of thy Lord of Might and Glory. Which is it, of the favours "
     "of your Lord, that ye deny?"),

    ("Return — Unto Thy Lord Is the Return",
     "Surah Al-Alaq 96:6–8",
     "Nay, but verily man is rebellious. That he thinketh himself independent! "
     "Lo! unto thy Lord is the return."),

    ("Return — The Soul at Peace",
     "Surah Al-Fajr 89:27–30",
     "But ah! thou soul at peace! Return unto thy Lord, content in His good "
     "pleasure! Enter thou among My bondmen! Enter thou My Garden!"),

    # ── THE HIDDEN / UNSEEN / MYSTICAL KNOWLEDGE ─────────────────────────────

    ("The Hidden — The Keys of the Invisible",
     "Surah Al-An'am 6:59",
     "And with Him are the keys of the Invisible. None but He knoweth them. And "
     "He knoweth what is in the land and the sea. Not a leaf falleth but He "
     "knoweth it, not a grain amid the darkness of the earth, naught of wet or "
     "dry but (it is noted) in a clear record."),

    ("The Hidden — Signs on the Horizons and Within Themselves",
     "Surah Fussilat 41:53",
     "We shall show them Our portents on the horizons and within themselves "
     "until it will be manifest unto them that it is the Truth. Doth not thy "
     "Lord suffice, since He is Witness over all things?"),

    ("The Hidden — And in Yourselves — Can Ye Not See?",
     "Surah Adh-Dhariyat 51:20–21",
     "And in the earth are portents for those whose faith is sure. And (also) "
     "in yourselves. Can ye then not see?"),

    ("The Hidden — He Knoweth What Ye Conceal",
     "Surah Al-Mulk 67:13–14",
     "And keep your opinion secret or proclaim it, lo! He is Knower of all that "
     "is in the breasts (of men). Should He not know what He created? And He is "
     "the Subtle, the Aware."),

    # ── TRANSFORMATION ───────────────────────────────────────────────────────

    ("Transformation — God Changes Not Until They Change Within",
     "Surah Ar-Ra'd 13:11",
     "For him are angels ranged before him and behind him, who guard him by "
     "Allah's command. Lo! Allah changeth not the condition of a folk until they "
     "(first) change that which is in their hearts; and if Allah willeth "
     "misfortune for a folk there is none that can repel it, nor have they a "
     "defender beside Him."),

    ("Transformation — As for Those Who Strive in Us",
     "Surah Al-Ankabut 29:69",
     "As for those who strive in Us, We surely guide them to Our paths, and lo! "
     "Allah is with the good."),

    ("Transformation — With Hardship Goes Ease",
     "Surah Ash-Sharh 94:1–8",
     "Have We not caused thy bosom to dilate, And eased thee of the burden "
     "Which weighed down thy back; And exalted thy fame? But lo! with hardship "
     "goeth ease; Lo! with hardship goeth ease; So when thou art relieved, "
     "still toil and strive to please thy Lord."),

    ("Transformation — Die Not Save in a State of Surrender",
     "Surah Al-Imran 3:102",
     "O ye who believe! Observe your duty to Allah with right observance, and "
     "die not save as those who have surrendered (unto Him)."),

    # ── THE OPENING / AL-FATIHA ──────────────────────────────────────────────

    ("The Opening — Al-Fatiha",
     "Surah Al-Fatiha 1:1–7",
     "In the name of Allah, the Beneficent, the Merciful. Praise be to Allah, "
     "Lord of the Worlds, The Beneficent, the Merciful. Master of the Day of "
     "Judgment, Thee (alone) we worship; Thee (alone) we ask for help. Show us "
     "the straight path, The path of those whom Thou hast favoured; Not the "
     "(path) of those who earn Thine anger nor of those who go astray."),

    # ── THE DIVINE COMPASSION / AR-RAHMAN ────────────────────────────────────

    ("The Compassionate — Which of the Favours of Your Lord Will Ye Deny?",
     "Surah Ar-Rahman 55:1–13",
     "The Beneficent hath made known the Quran. He hath created man. He hath "
     "taught him utterance. The sun and the moon are made punctual. The stars "
     "and the trees adore. And the sky He hath uplifted; and He hath set the "
     "measure, that ye exceed not the measure, but observe the measure strictly, "
     "nor fall short thereof. And the earth hath He appointed for (His) "
     "creatures, wherein are fruit and sheathed palm-trees, husked grain and "
     "scented herb. Which is it, of the favours of your Lord, that ye deny?"),

    # ── NIGHT JOURNEY / ASCENT ───────────────────────────────────────────────

    ("Ascent — Glory to Him Who Took His Servant by Night",
     "Surah Al-Isra 17:1",
     "Glory be to Him Who carried His servant by night from the Inviolable "
     "Place of Worship to the Far Distant Place of Worship the neighbourhood "
     "whereof We have blessed, that We might show him of Our tokens! Lo! He, "
     "only He, is the Hearer, the Seer."),

    ("Ascent — He Saw Him on the Clear Horizon",
     "Surah At-Takwir 81:19–25",
     "That this is in truth the word of an honoured messenger, mighty, "
     "established in the presence of the Lord of the Throne, (One) to be "
     "obeyed, and trustworthy; and your comrade is not mad. Surely he beheld "
     "Him on the clear horizon. And he is not avid of the Unseen. Nor is this "
     "the utterance of a devil worthy to be stoned."),

    # ── PRAYER AND PROSTRATION ───────────────────────────────────────────────

    ("Prostration — Prostrate Thyself and Draw Near",
     "Surah Al-Alaq 96:19",
     "Nay! Obey not thou him. But prostrate thyself, and draw near (unto "
     "Allah)."),

    ("Prayer — Call Upon Him in Fear and Hope",
     "Surah Al-A'raf 7:55–56",
     "Call upon your Lord humbly and in secret. Lo! He loveth not aggressors. "
     "Work not confusion in the earth after the fair ordering (thereof), and "
     "call on Him in fear and hope. Lo! the mercy of Allah is nigh unto the "
     "good."),

]


class QuranPassagesIngester(BaseIngester):
    tradition = "sufism"
    text_name = "quran_passages"
    display_name = "Quran — Curated Passages (Pickthall 1930)"
    source_url = "https://sacred-texts.com/isl/pick/index.htm"

    def get_chunks(self) -> list[dict]:
        chunks = []
        theme_counts: dict[str, int] = {}
        for theme, reference, text in PASSAGES:
            top = theme.split(" — ")[0]
            theme_counts[top] = theme_counts.get(top, 0) + 1
            labeled = (
                f"Quran — {theme}\n"
                f"{reference}\n\n{text}"
            )
            chunks.append({
                "tradition": self.tradition,
                "text_name": self.text_name,
                "author": "Revealed to the Prophet Muhammad (PBUH)",
                "translator": "Marmaduke Pickthall (1930)",
                "date_composed": "610–632 CE",
                "book": reference.split()[1] if len(reference.split()) > 1 else "Quran",
                "chapter": reference,
                "section": theme.lower().replace(" ", "_").replace("—", "").replace("-", "_")[:80],
                "content": labeled,
                "priority": 1,
                "content_type": "primary_canon",
                "source_url": self.source_url,
                "language": "english",
                "themes": THEMES,
                "cross_tradition_tags": CROSS_TAGS,
                "metadata": {
                    "theme": theme,
                    "reference": reference,
                    "translation": "Pickthall 1930",
                },
            })

        print(f"    {len(chunks)} curated ayat across {len(theme_counts)} themes")
        for t, n in sorted(theme_counts.items()):
            print(f"      {t}: {n}")
        return chunks
