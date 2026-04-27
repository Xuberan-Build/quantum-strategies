"""
Bible — Curated Passages (King James Version, 1611 — public domain)
Thematically organized for Quantum Strategies RAG:
  divine identity, transformation, inner kingdom, union, light,
  darkness/void, logos/declaration, wisdom, death/rebirth, love, stillness, vision.
No chapter-by-chapter scraping — hand-selected passages that directly
inform the Three Rites products and their cross-tradition resonances.
"""
from scrapers.base import BaseIngester

THEMES = [
    "bible", "kjv", "christian_mysticism", "transformation",
    "divine_identity", "consciousness", "sacred_scripture",
]
CROSS_TAGS = [
    "divine_union", "consciousness", "transformation", "ego_dissolution",
    "transcendence", "stages_of_development", "emptiness_void",
]

# Each entry: (theme_label, reference, text)
# Chunks are grouped thematically so retrieval pulls a coherent set.
PASSAGES = [

    # ── DIVINE IDENTITY: You Are Gods ────────────────────────────────────────

    ("Divine Identity — You Are Gods",
     "Psalm 82:6",
     "I have said, Ye are gods; and all of you are children of the most High."),

    ("Divine Identity — You Are Gods",
     "John 10:34–35",
     "Jesus answered them, Is it not written in your law, I said, Ye are gods? "
     "If he called them gods, unto whom the word of God came, and the scripture "
     "cannot be broken..."),

    ("Divine Identity — Created in the Image",
     "Genesis 1:26–27",
     "And God said, Let us make man in our image, after our likeness: and let "
     "them have dominion over the fish of the sea, and over the fowl of the air, "
     "and over the cattle, and over all the earth, and over every creeping thing "
     "that creepeth upon the earth. So God created man in his own image, in the "
     "image of God created he him; male and female created he them."),

    ("Divine Identity — Partakers of the Divine Nature",
     "2 Peter 1:3–4",
     "According as his divine power hath given unto us all things that pertain "
     "unto life and godliness, through the knowledge of him that hath called us "
     "to glory and virtue: Whereby are given unto us exceeding great and precious "
     "promises: that by these ye might be partakers of the divine nature, having "
     "escaped the corruption that is in the world through lust."),

    ("Divine Identity — Temple of God",
     "1 Corinthians 3:16–17",
     "Know ye not that ye are the temple of God, and that the Spirit of God "
     "dwelleth in you? If any man defile the temple of God, him shall God "
     "destroy; for the temple of God is holy, which temple ye are."),

    ("Divine Identity — Children and Heirs",
     "Romans 8:16–17",
     "The Spirit itself beareth witness with our spirit, that we are the children "
     "of God: And if children, then heirs; heirs of God, and joint-heirs with "
     "Christ; if so be that we suffer with him, that we may be also glorified "
     "together."),

    ("Divine Identity — Sons of the Most High",
     "Acts 17:28–29",
     "For in him we live, and move, and have our being; as certain also of your "
     "own poets have said, For we are also his offspring. Forasmuch then as we "
     "are the offspring of God, we ought not to think that the Godhead is like "
     "unto gold, or silver, or stone, graven by art and man's device."),

    # ── TRANSFORMATION & RENEWAL OF MIND ────────────────────────────────────

    ("Transformation — Renewing of Your Mind",
     "Romans 12:1–2",
     "I beseech you therefore, brethren, by the mercies of God, that ye present "
     "your bodies a living sacrifice, holy, acceptable unto God, which is your "
     "reasonable service. And be not conformed to this world: but be ye "
     "transformed by the renewing of your mind, that ye may prove what is that "
     "good, and acceptable, and perfect, will of God."),

    ("Transformation — Changed from Glory to Glory",
     "2 Corinthians 3:17–18",
     "Now the Lord is that Spirit: and where the Spirit of the Lord is, there is "
     "liberty. But we all, with open face beholding as in a glass the glory of "
     "the Lord, are changed into the same image from glory to glory, even as by "
     "the Spirit of the Lord."),

    ("Transformation — Put On the New Man",
     "Ephesians 4:22–24",
     "That ye put off concerning the former conversation the old man, which is "
     "corrupt according to the deceitful lusts; And be renewed in the spirit of "
     "your mind; And that ye put on the new man, which after God is created in "
     "righteousness and true holiness."),

    ("Transformation — Renewed in Knowledge",
     "Colossians 3:9–10",
     "Lie not one to another, seeing that ye have put off the old man with his "
     "deeds; And have put on the new man, which is renewed in knowledge after "
     "the image of him that created him: Where there is neither Greek nor Jew, "
     "circumcision nor uncircumcision, Barbarian, Scythian, bond nor free: but "
     "Christ is all, and in all."),

    ("Transformation — All Things Become New",
     "2 Corinthians 5:16–17",
     "Wherefore henceforth know we no man after the flesh: yea, though we have "
     "known Christ after the flesh, yet now henceforth know we him no more. "
     "Therefore if any man be in Christ, he is a new creature: old things are "
     "passed away; behold, all things are become new."),

    ("Transformation — Conformed to His Image",
     "Romans 8:28–30",
     "And we know that all things work together for good to them that love God, "
     "to them who are the called according to his purpose. For whom he did "
     "foreknow, he also did predestinate to be conformed to the image of his "
     "Son, that he might be the firstborn among many brethren. Moreover whom he "
     "did predestinate, them he also called: and whom he called, them he also "
     "justified: and whom he justified, them he also glorified."),

    # ── INNER KINGDOM ────────────────────────────────────────────────────────

    ("Inner Kingdom — The Kingdom Is Within You",
     "Luke 17:20–21",
     "And when he was demanded of the Pharisees, when the kingdom of God should "
     "come, he answered them and said, The kingdom of God cometh not with "
     "observation: Neither shall they say, Lo here! or, lo there! for, behold, "
     "the kingdom of God is within you."),

    ("Inner Kingdom — The Single Eye",
     "Matthew 6:22–23",
     "The light of the body is the eye: if therefore thine eye be single, thy "
     "whole body shall be full of light. But if thine eye be evil, thy whole "
     "body shall be full of darkness. If therefore the light that is in thee be "
     "darkness, how great is that darkness!"),

    ("Inner Kingdom — Hidden Treasure and Pearl",
     "Matthew 13:44–46",
     "Again, the kingdom of heaven is like unto treasure hid in a field; the "
     "which when a man hath found, he hideth, and for joy thereof goeth and "
     "selleth all that he hath, and buyeth that field. Again, the kingdom of "
     "heaven is like unto a merchant man, seeking goodly pearls: Who, when he "
     "had found one pearl of great price, went and sold all that he had, and "
     "bought it."),

    ("Inner Kingdom — Seek First",
     "Matthew 6:33",
     "But seek ye first the kingdom of God, and his righteousness; and all these "
     "things shall be added unto you."),

    ("Inner Kingdom — Ask Seek Knock",
     "Matthew 7:7–8",
     "Ask, and it shall be given you; seek, and ye shall find; knock, and it "
     "shall be opened unto you: For every one that asketh receiveth; and he that "
     "seeketh findeth; and to him that knocketh it shall be opened."),

    ("Inner Kingdom — Pray in Secret",
     "Matthew 6:6",
     "But thou, when thou prayest, enter into thy closet, and when thou hast "
     "shut thy door, pray to thy Father which is in secret; and thy Father which "
     "seeth in secret shall reward thee openly."),

    # ── UNION AND NON-DUALITY ────────────────────────────────────────────────

    ("Union — That They May Be One",
     "John 17:20–23",
     "Neither pray I for these alone, but for them also which shall believe on "
     "me through their word; That they all may be one; as thou, Father, art in "
     "me, and I in thee, that they also may be one in us: that the world may "
     "believe that thou hast sent me. And the glory which thou gavest me I have "
     "given them; that they may be one, even as we are one: I in them, and thou "
     "in me, that they may be made perfect in one."),

    ("Union — I Am in My Father and Ye in Me",
     "John 14:19–20",
     "Yet a little while, and the world seeth me no more; but ye see me: because "
     "I live, ye shall live also. At that day ye shall know that I am in my "
     "Father, and ye in me, and I in you."),

    ("Union — I and My Father Are One",
     "John 10:30",
     "I and my Father are one."),

    ("Union — Not I but Christ",
     "Galatians 2:20",
     "I am crucified with Christ: nevertheless I live; yet not I, but Christ "
     "liveth in me: and the life which I now live in the flesh I live by the "
     "faith of the Son of God, who loved me, and gave himself for me."),

    ("Union — God All in All",
     "1 Corinthians 15:27–28",
     "For he hath put all things under his feet. But when he saith all things "
     "are put under him, it is manifest that he is excepted, which did put all "
     "things under him. And when all things shall be subdued unto him, then "
     "shall the Son also himself be subject unto him that put all things under "
     "him, that God may be all in all."),

    ("Union — One God Above Through and In All",
     "Ephesians 4:4–6",
     "There is one body, and one Spirit, even as ye are called in one hope of "
     "your calling; One Lord, one faith, one baptism, One God and Father of all, "
     "who is above all, and through all, and in you all."),

    # ── LIGHT AND CONSCIOUSNESS ───────────────────────────────────────────────

    ("Light — The Word Was the Light of Men",
     "John 1:1–5",
     "In the beginning was the Word, and the Word was with God, and the Word "
     "was God. The same was in the beginning with God. All things were made by "
     "him; and without him was not any thing made that was made. In him was "
     "life; and the life was the light of men. And the light shineth in "
     "darkness; and the darkness comprehended it not."),

    ("Light — The Word Made Flesh",
     "John 1:14",
     "And the Word was made flesh, and dwelt among us, (and we beheld his "
     "glory, the glory as of the only begotten of the Father,) full of grace "
     "and truth."),

    ("Light — I Am the Light of the World",
     "John 8:12",
     "Then spake Jesus again unto them, saying, I am the light of the world: "
     "he that followeth me shall not walk in darkness, but shall have the light "
     "of life."),

    ("Light — Ye Are the Light of the World",
     "Matthew 5:14–16",
     "Ye are the light of the world. A city that is set on an hill cannot be "
     "hid. Neither do men light a candle, and put it under a bushel, but on a "
     "candlestick; and it giveth light unto all that are in the house. Let your "
     "light so shine before men, that they may see your good works, and glorify "
     "your Father which is in heaven."),

    ("Light — God Is Light",
     "1 John 1:5–7",
     "This then is the message which we have heard of him, and declare unto "
     "you, that God is light, and in him is no darkness at all. If we say that "
     "we have fellowship with him, and walk in darkness, we lie, and do not the "
     "truth: But if we walk in the light, as he is in the light, we have "
     "fellowship one with another."),

    ("Light — In Thy Light Shall We See Light",
     "Psalm 36:7–9",
     "How excellent is thy lovingkindness, O God! therefore the children of men "
     "put their trust under the shadow of thy wings. They shall be abundantly "
     "satisfied with the fatness of thy house; and thou shalt make them drink of "
     "the river of thy pleasures. For with thee is the fountain of life: in thy "
     "light shall we see light."),

    ("Light — Arise and Shine",
     "Isaiah 60:1–2",
     "Arise, shine; for thy light is come, and the glory of the LORD is risen "
     "upon thee. For, behold, the darkness shall cover the earth, and gross "
     "darkness the people: but the LORD shall arise upon thee, and his glory "
     "shall be seen upon thee."),

    ("Light — Awake from Sleep",
     "Ephesians 5:13–14",
     "But all things that are reproved are made manifest by the light: for "
     "whatsoever doth make manifest is light. Wherefore he saith, Awake thou "
     "that sleepest, and arise from the dead, and Christ shall give thee light."),

    # ── DARKNESS, VOID AND HIDDEN WISDOM ────────────────────────────────────

    ("Darkness — The Darkness and the Light Are Both Alike",
     "Psalm 139:7–12",
     "Whither shall I go from thy spirit? or whither shall I flee from thy "
     "presence? If I ascend up into heaven, thou art there: if I make my bed in "
     "hell, behold, thou art there. If I take the wings of the morning, and "
     "dwell in the uttermost parts of the sea; Even there shall thy hand lead "
     "me, and thy right hand shall hold me. If I say, Surely the darkness shall "
     "cover me; even the night shall be light about me. Yea, the darkness "
     "hideth not from thee; but the night shineth as the day: the darkness and "
     "the light are both alike to thee."),

    ("Darkness — Treasures of Darkness",
     "Isaiah 45:2–3",
     "I will go before thee, and make the crooked places straight: I will break "
     "in pieces the gates of brass, and cut in sunder the bars of iron: And I "
     "will give thee the treasures of darkness, and hidden riches of secret "
     "places, that thou mayest know that I, the LORD, which call thee by thy "
     "name, am the God of Israel."),

    ("Darkness — Moses Entered the Thick Darkness Where God Was",
     "Exodus 20:18–21",
     "And all the people saw the thunderings, and the lightnings, and the noise "
     "of the trumpet, and the mountain smoking: and when the people saw it, they "
     "removed, and stood afar off. And they said unto Moses, Speak thou with us, "
     "and we will hear: but let not God speak with us, lest we die. And Moses "
     "said unto the people, Fear not: for God is come to prove you, and that his "
     "fear may be before your faces, that ye sin not. And the people stood afar "
     "off, and Moses drew near unto the thick darkness where God was."),

    ("Darkness — The Still Small Voice",
     "1 Kings 19:11–13",
     "And he said, Go forth, and stand upon the mount before the LORD. And, "
     "behold, the LORD passed by, and a great and strong wind rent the "
     "mountains, and brake in pieces the rocks before the LORD; but the LORD "
     "was not in the wind: and after the wind an earthquake; but the LORD was "
     "not in the earthquake: And after the earthquake a fire; but the LORD was "
     "not in the fire: and after the fire a still small voice. And it was so, "
     "when Elijah heard it, that he wrapped his face in his mantle, and went "
     "out, and stood in the entering in of the cave."),

    ("Darkness — The Hidden Wisdom",
     "1 Corinthians 2:6–10",
     "Howbeit we speak wisdom among them that are perfect: yet not the wisdom "
     "of this world, nor of the princes of this world, that come to nought: But "
     "we speak the wisdom of God in a mystery, even the hidden wisdom, which God "
     "ordained before the world unto our glory: Which none of the princes of "
     "this world knew: for had they known it, they would not have crucified the "
     "Lord of glory. But as it is written, Eye hath not seen, nor ear heard, "
     "neither have entered into the heart of man, the things which God hath "
     "prepared for them that love him. But God hath revealed them unto us by his "
     "Spirit: for the Spirit searcheth all things, yea, the deep things of God."),

    ("Darkness — Secret Things Belong to God",
     "Deuteronomy 29:29",
     "The secret things belong unto the LORD our God: but those things which "
     "are revealed belong unto us and to our children for ever, that we may do "
     "all the words of this law."),

    # ── THE WORD / LOGOS / POWER OF DECLARATION ─────────────────────────────

    ("Logos — Let There Be Light",
     "Genesis 1:1–5",
     "In the beginning God created the heaven and the earth. And the earth was "
     "without form, and void; and darkness was upon the face of the deep. And "
     "the Spirit of God moved upon the face of the waters. And God said, Let "
     "there be light: and there was light. And God saw the light, that it was "
     "good: and God divided the light from the darkness. And God called the "
     "light Day, and the darkness he called Night. And the evening and the "
     "morning were the first day."),

    ("Logos — My Word Shall Not Return Void",
     "Isaiah 55:10–11",
     "For as the rain cometh down, and the snow from heaven, and returneth not "
     "thither, but watereth the earth, and maketh it bring forth and bud, that "
     "it may give seed to the sower, and bread to the eater: So shall my word "
     "be that goeth forth out of my mouth: it shall not return unto me void, but "
     "it shall accomplish that which I please, and it shall prosper in the thing "
     "whereto I sent it."),

    ("Logos — Death and Life in the Power of the Tongue",
     "Proverbs 18:21",
     "Death and life are in the power of the tongue: and they that love it "
     "shall eat the fruit thereof."),

    ("Logos — Whosoever Shall Say",
     "Mark 11:22–24",
     "And Jesus answering saith unto them, Have faith in God. For verily I say "
     "unto you, That whosoever shall say unto this mountain, Be thou removed, "
     "and be thou cast into the sea; and shall not doubt in his heart, but shall "
     "believe that those things which he saith shall come to pass; he shall have "
     "whatsoever he saith. Therefore I say unto you, What things soever ye "
     "desire, when ye pray, believe that ye receive them, and ye shall have them."),

    ("Logos — The Word Quick and Powerful",
     "Hebrews 4:12",
     "For the word of God is quick, and powerful, and sharper than any "
     "twoedged sword, piercing even to the dividing asunder of soul and spirit, "
     "and of the joints and marrow, and is a discerner of the thoughts and "
     "intents of the heart."),

    # ── WISDOM / SOPHIA ───────────────────────────────────────────────────────

    ("Wisdom — Sophia Present at Creation",
     "Proverbs 8:22–31",
     "The LORD possessed me at the beginning of his work, the first of his acts "
     "of old. Ages ago I was set up, at the first, before the beginning of the "
     "earth. When there were no depths I was brought forth, when there were no "
     "springs abounding with water. Before the mountains had been shaped, before "
     "the hills, I was brought forth, before he had made the earth with its "
     "fields, or the first of the dust of the world. When he established the "
     "heavens, I was there; when he drew a circle on the face of the deep, when "
     "he made firm the skies above, when he established the fountains of the "
     "deep, when he assigned to the sea its limit, so that the waters might not "
     "transgress his command, when he marked out the foundations of the earth, "
     "then I was beside him, like a master workman, and I was daily his delight, "
     "rejoicing before him always, rejoicing in his inhabited world and "
     "delighting in the children of man."),

    ("Wisdom — She Is a Tree of Life",
     "Proverbs 3:13–18",
     "Happy is the man that findeth wisdom, and the man that getteth "
     "understanding. For the merchandise of it is better than the merchandise "
     "of silver, and the gain thereof than fine gold. She is more precious than "
     "rubies: and all the things thou canst desire are not to be compared unto "
     "her. Length of days is in her right hand; and in her left hand riches and "
     "honour. Her ways are ways of pleasantness, and all her paths are peace. "
     "She is a tree of life to them that lay hold upon her: and happy is every "
     "one that retaineth her."),

    ("Wisdom — Write the Vision",
     "Habakkuk 2:2–3",
     "And the LORD answered me, and said, Write the vision, and make it plain "
     "upon tables, that he may run that readeth it. For the vision is yet for an "
     "appointed time, but at the end it shall speak, and not lie: though it "
     "tarry, wait for it; because it will surely come, it will not tarry."),

    # ── DEATH AND REBIRTH / EGO DISSOLUTION ─────────────────────────────────

    ("Death and Rebirth — Unless a Grain of Wheat Die",
     "John 12:23–25",
     "And Jesus answered them, saying, The hour is come, that the Son of man "
     "should be glorified. Verily, verily, I say unto you, Except a corn of "
     "wheat fall into the ground and die, it abideth alone: but if it die, it "
     "bringeth forth much fruit. He that loveth his life shall lose it; and he "
     "that hateth his life in this world shall keep it unto life eternal."),

    ("Death and Rebirth — Born Again of the Spirit",
     "John 3:3–8",
     "Jesus answered and said unto him, Verily, verily, I say unto thee, Except "
     "a man be born again, he cannot see the kingdom of God. Nicodemus saith "
     "unto him, How can a man be born when he is old? can he enter the second "
     "time into his mother's womb, and be born? Jesus answered, Verily, verily, "
     "I say unto thee, Except a man be born of water and of the Spirit, he "
     "cannot enter into the kingdom of God. That which is born of the flesh is "
     "flesh; and that which is born of the Spirit is spirit. Marvel not that I "
     "said unto thee, Ye must be born again. The wind bloweth where it listeth, "
     "and thou hearest the sound thereof, but canst not tell whence it cometh, "
     "and whither it goeth: so is every one that is born of the Spirit."),

    ("Death and Rebirth — Buried and Raised",
     "Romans 6:3–5",
     "Know ye not, that so many of us as were baptized into Jesus Christ were "
     "baptized into his death? Therefore we are buried with him by baptism into "
     "death: that like as Christ was raised up from the dead by the glory of the "
     "Father, even so we also should walk in newness of life. For if we have "
     "been planted together in the likeness of his death, we shall be also in "
     "the likeness of his resurrection."),

    ("Death and Rebirth — Lose Your Life to Find It",
     "Luke 9:23–25",
     "And he said to them all, If any man will come after me, let him deny "
     "himself, and take up his cross daily, and follow me. For whosoever will "
     "save his life shall lose it: but whosoever will lose his life for my sake, "
     "the same shall save it. For what is a man advantaged, if he gain the whole "
     "world, and lose himself, or be cast away?"),

    ("Death and Rebirth — I Die Daily",
     "1 Corinthians 15:30–32",
     "And why stand we in jeopardy every hour? I protest by your rejoicing "
     "which I have in Christ Jesus our Lord, I die daily. If after the manner "
     "of men I have fought with beasts at Ephesus, what advantageth it me, if "
     "the dead rise not? let us eat and drink; for to morrow we die."),

    # ── LOVE AS COSMIC FORCE ─────────────────────────────────────────────────

    ("Love — God Is Love",
     "1 John 4:7–12",
     "Beloved, let us love one another: for love is of God; and every one that "
     "loveth is born of God, and knoweth God. He that loveth not knoweth not "
     "God; for God is love. In this was manifested the love of God toward us, "
     "because that God sent his only begotten Son into the world, that we might "
     "live through him. Herein is love, not that we loved God, but that he loved "
     "us, and sent his Son to be the propitiation for our sins. Beloved, if God "
     "so loved us, we ought also to love one another. No man hath seen God at "
     "any time. If we love one another, God dwelleth in us, and his love is "
     "perfected in us."),

    ("Love — Perfect Love Casts Out Fear",
     "1 John 4:16–18",
     "And we have known and believed the love that God hath to us. God is love; "
     "and he that dwelleth in love dwelleth in God, and God in him. Herein is "
     "our love made perfect, that we may have boldness in the day of judgment: "
     "because as he is, so are we in this world. There is no fear in love; but "
     "perfect love casteth out fear: because fear hath torment. He that feareth "
     "is not made perfect in love."),

    ("Love — The Greatest of These",
     "1 Corinthians 13:1–13",
     "Though I speak with the tongues of men and of angels, and have not "
     "charity, I am become as sounding brass, or a tinkling cymbal. And though "
     "I have the gift of prophecy, and understand all mysteries, and all "
     "knowledge; and though I have all faith, so that I could remove mountains, "
     "and have not charity, I am nothing. And though I bestow all my goods to "
     "feed the poor, and though I give my body to be burned, and have not "
     "charity, it profiteth me nothing. Charity suffereth long, and is kind; "
     "charity envieth not; charity vaunteth not itself, is not puffed up, Doth "
     "not behave itself unseemly, seeketh not her own, is not easily provoked, "
     "thinketh no evil; Rejoiceth not in iniquity, but rejoiceth in the truth; "
     "Beareth all things, believeth all things, hopeth all things, endureth all "
     "things. Charity never faileth: but whether there be prophecies, they shall "
     "fail; whether there be tongues, they shall cease; whether there be "
     "knowledge, it shall vanish away. For now we know in part, and we prophesy "
     "in part. But when that which is perfect is come, then that which is in "
     "part shall be done away. When I was a child, I spake as a child, I "
     "understood as a child, I thought as a child: but when I became a man, I "
     "put away childish things. For now we see through a glass, darkly; but "
     "then face to face: now I know in part; but then shall I know even as also "
     "I am known. And now abideth faith, hope, charity, these three; but the "
     "greatest of these is charity."),

    ("Love — Nothing Can Separate Us",
     "Romans 8:37–39",
     "Nay, in all these things we are more than conquerors through him that "
     "loved us. For I am persuaded, that neither death, nor life, nor angels, "
     "nor principalities, nor powers, nor things present, nor things to come, "
     "Nor height, nor depth, nor any other creature, shall be able to separate "
     "us from the love of God, which is in Christ Jesus our Lord."),

    ("Love — Love Is Strong as Death",
     "Song of Solomon 8:6–7",
     "Set me as a seal upon thine heart, as a seal upon thine arm: for love is "
     "strong as death; jealousy is cruel as the grave: the coals thereof are "
     "coals of fire, which hath a most vehement flame. Many waters cannot quench "
     "love, neither can the floods drown it: if a man would give all the "
     "substance of his house for love, it would utterly be contemned."),

    # ── STILLNESS AND CONTEMPLATION ──────────────────────────────────────────

    ("Stillness — Be Still and Know",
     "Psalm 46:1–2, 10–11",
     "God is our refuge and strength, a very present help in trouble. Therefore "
     "will not we fear, though the earth be removed, and though the mountains be "
     "carried into the midst of the sea... Be still, and know that I am God: I "
     "will be exalted among the heathen, I will be exalted in the earth. The "
     "LORD of hosts is with us; the God of Jacob is our refuge."),

    ("Stillness — He Restoreth My Soul",
     "Psalm 23:1–3",
     "The LORD is my shepherd; I shall not want. He maketh me to lie down in "
     "green pastures: he leadeth me beside the still waters. He restoreth my "
     "soul: he leadeth me in the paths of righteousness for his name's sake."),

    ("Stillness — In Quietness Shall Be Your Strength",
     "Isaiah 30:15",
     "For thus saith the Lord GOD, the Holy One of Israel; In returning and "
     "rest shall ye be saved; in quietness and in confidence shall be your "
     "strength: and ye would not."),

    ("Stillness — Let All the Earth Keep Silence",
     "Habakkuk 2:20",
     "But the LORD is in his holy temple: let all the earth keep silence "
     "before him."),

    # ── VISION AND PROPHECY ───────────────────────────────────────────────────

    ("Vision — Your Sons and Daughters Shall Prophesy",
     "Joel 2:28–29",
     "And it shall come to pass afterward, that I will pour out my spirit upon "
     "all flesh; and your sons and your daughters shall prophesy, your old men "
     "shall dream dreams, your young men shall see visions: And also upon the "
     "servants and upon the handmaids in those days will I pour out my spirit."),

    ("Vision — Where There Is No Vision the People Perish",
     "Proverbs 29:18",
     "Where there is no vision, the people perish: but he that keepeth the law, "
     "happy is he."),

    ("Vision — Isaiah's Throne Vision",
     "Isaiah 6:1–8",
     "In the year that king Uzziah died I saw also the Lord sitting upon a "
     "throne, high and lifted up, and his train filled the temple. Above it "
     "stood the seraphims: each one had six wings; with twain he covered his "
     "face, and with twain he covered his feet, and with twain he did fly. And "
     "one cried unto another, and said, Holy, holy, holy, is the LORD of hosts: "
     "the whole earth is full of his glory. And the posts of the door moved at "
     "the voice of him that cried, and the house was filled with smoke. Then "
     "said I, Woe is me! for I am undone; because I am a man of unclean lips, "
     "and I dwell in the midst of a people of unclean lips: for mine eyes have "
     "seen the King, the LORD of hosts. Then flew one of the seraphims unto me, "
     "having a live coal in his hand, which he had taken with the tongs from off "
     "the altar: And he laid it upon my mouth, and said, Lo, this hath touched "
     "thy lips; and thine iniquity is taken away, and thy sin purged. Also I "
     "heard the voice of the Lord, saying, Whom shall I send, and who will go "
     "for us? Then said I, Here am I; send me."),

    ("Vision — Ezekiel's Vision of the Chariot",
     "Ezekiel 1:4–5, 26–28",
     "And I looked, and, behold, a whirlwind came out of the north, a great "
     "cloud, and a fire infolding itself, and a brightness was about it, and out "
     "of the midst thereof as the colour of amber, out of the midst of the fire. "
     "Also out of the midst thereof came the likeness of four living creatures. "
     "And this was their appearance; they had the likeness of a man... And above "
     "the firmament that was over their heads was the likeness of a throne, as "
     "the appearance of a sapphire stone: and upon the likeness of the throne "
     "was the likeness as the appearance of a man above upon it. And I saw as "
     "the colour of amber, as the appearance of fire round about within it, from "
     "the appearance of his loins even upward, and from the appearance of his "
     "loins even downward, I saw as it were the appearance of fire, and it had "
     "brightness round about. As the appearance of the bow that is in the cloud "
     "in the day of rain, so was the appearance of the brightness round about. "
     "This was the appearance of the likeness of the glory of the LORD."),

]


class BiblePassagesIngester(BaseIngester):
    tradition = "christian_mysticism"
    text_name = "bible_passages"
    display_name = "Bible — Curated Passages (KJV)"
    source_url = "https://sacred-texts.com/bib/kjv/"

    def get_chunks(self) -> list[dict]:
        chunks = []
        for theme, reference, text in PASSAGES:
            labeled = (
                f"Bible (KJV) — {theme}\n"
                f"{reference}\n\n{text}"
            )
            chunks.append({
                "tradition": self.tradition,
                "text_name": self.text_name,
                "author": "Various (Hebrew and Greek authors)",
                "translator": "King James Version (1611)",
                "date_composed": "~1000 BCE – 100 CE",
                "book": reference.split()[0] if reference else "Bible",
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
                    "translation": "KJV 1611",
                },
            })
        print(f"    {len(chunks)} curated passages across {len(set(t for t,_,_ in PASSAGES))} themes")
        return chunks
