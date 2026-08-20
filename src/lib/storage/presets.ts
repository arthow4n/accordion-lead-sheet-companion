import type { LeadSheetSong } from "../../types/index.ts";
import { parseLeadSheetText } from "../parser/tokenizer.ts";

const BELLA_CIAO_RAW = `{title: Bella Ciao}
{artist: Italian Folk}
{capo: 2}

[Verse 1]
[Am]Una mattina mi son svegliato
O bella [Dm]ciao bella ciao bella [Am]ciao ciao ciao
Una mat[Am]tina mi son svegli[Dm]ato
E ho tro[E7]vato l'inva[Am]sor

[Verse 2]
[Am]O partigiano porta-mi via
O bella [Dm]ciao bella ciao bella [Am]ciao ciao ciao
O parti[Am]giano porta-mi [Dm]via
Che mi [E7]sento di mo[Am]rir

[Chorus]
[Am]E se io muoio da partigiano
O bella [Dm]ciao bella ciao bella [Am]ciao ciao ciao
E se io [Am]muoio da parti[Dm]giano
Tu mi [E7]devi seppel[Am]lir`;

const COUNTRY_ROADS_RAW = `{title: Take Me Home, Country Roads}
{artist: John Denver}
{capo: 2}

[Verse 1]
[G]Almost heaven, [Em]West Virginia
[D]Blue Ridge Mountains, [C]Shenandoah [G]River
[G]Life is old there, [Em]older than the trees
[D]Younger than the mountains, [C]growin' like a [G]breeze

[Chorus]
Country [G]roads, take me [D]home
To the [Em]place I be[C]long
West Vir[G]ginia, mountain [D]mama
Take me [C]home, country [G]roads

[Bridge]
[Em]I hear her [D/F#]voice in the [G]mornin' hour she calls me
The [C]radio re[G]minds me of my [D]home far away`;

const HOUSE_OF_THE_RISING_SUN_RAW = `{title: House of the Rising Sun}
{artist: The Animals}
{capo: 0}

[Verse 1]
There [Am]is a [C/G]house in [D/F#]New Or[F]leans
They [Am]call the [C/G]Rising [E7]Sun
And it's [Am]been the [C/G]ruin of [D/F#]many a poor [F]boy
And [Am]God I [E7]know I'm [Am]one [E7]

[Verse 2]
My [Am]mother [C/G]was a [D/F#]tailor [F]
She [Am]sewed my [C/G]new blue [E7]jeans
My [Am]father [C/G]was a [D/F#]gamblin' [F]man
[Am]Down in [E7]New Or[Am]leans [E7]`;

const LA_VIE_EN_ROSE_RAW = `{title: La Vie En Rose}
{artist: Édith Piaf}
{capo: 0}

[Verse 1]
Des yeux qui [C]font baisser les [Cmaj7]miens
Un rire qui [C6]se perd sur sa [Cmaj7]bouche
Voilà le [C]portrait sans re[Cmaj7]touche
De l'homme au[Dm7]quel j'appar[G7]tiens

[Chorus]
Quand il me [Dm7]prend dans ses [G7]bras
Il me parle [Dm7]tout [G7]bas
Je vois la [C]vie en rose [Cmaj7] [C6]
Il me dit [C]des mots d'a[Cmaj7]mour
Des mots de [Dm7]tous les [G7]jours
Et ça me [Dm7]fait quelque [G7]chose`;

const AUTUMN_LEAVES_RAW = `{title: Autumn Leaves}
{artist: Joseph Kosma}
{capo: 0}

[Verse 1]
The falling [Am7]leaves drift by the [D7]window
The autumn [Gmaj7]leaves of red and [Cmaj7]gold
I see your [F#m7b5]lips, the summer [B7]kisses
The sun-burned [Em]hands I used to hold

[Chorus]
Since you went a[F#m7b5]way the days grow [B7]long
And soon I'll [Em]hear old winter's song
But I miss you [Am7]most of all my [D7]darling
When autumn [Gmaj7]leaves begin to [Cmaj7]fall`;

const VALZER_DI_MEZZANOTTE_RAW = `{title: Valzer di Mezzanotte}
{artist: Italian Traditional}
{capo: 0}

[Verse 1]
[Am]Sotto la luna di [Dm]mezzanotte
[E7]Suona la fisar[Am]monica
[Am]Girano le coppie nel [Dm]vecchio borgo
[E7]Al ritmo del val[Am]zer

[Chorus]
[A7]Vola la musica [Dm]nell'aria fresca
[G7]Sotto le stelle del [C]cielo blu
[F]Balla con me questa [Dm]notte d'incanto
[E7]Non fermarti [Am]più`;

export function createPresetSongs(): LeadSheetSong[] {
  const bellaCiao = parseLeadSheetText(BELLA_CIAO_RAW, 2, "Am");
  bellaCiao.id = "preset_bella_ciao";

  const countryRoads = parseLeadSheetText(COUNTRY_ROADS_RAW, 2, "G");
  countryRoads.id = "preset_country_roads";

  const houseRisingSun = parseLeadSheetText(HOUSE_OF_THE_RISING_SUN_RAW, 0, "Am");
  houseRisingSun.id = "preset_house_rising_sun";

  const laVieEnRose = parseLeadSheetText(LA_VIE_EN_ROSE_RAW, 0, "C");
  laVieEnRose.id = "preset_la_vie_en_rose";

  const autumnLeaves = parseLeadSheetText(AUTUMN_LEAVES_RAW, 0, "Em");
  autumnLeaves.id = "preset_autumn_leaves";

  const valzerMezzanotte = parseLeadSheetText(VALZER_DI_MEZZANOTTE_RAW, 0, "Am");
  valzerMezzanotte.id = "preset_valzer_mezzanotte";

  return [
    bellaCiao,
    countryRoads,
    houseRisingSun,
    laVieEnRose,
    autumnLeaves,
    valzerMezzanotte,
  ];
}

export const PRESET_SONGS: LeadSheetSong[] = createPresetSongs();
