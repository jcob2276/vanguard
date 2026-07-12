/** Drzewo domyślnych skilli życiowych + pod-skilli (SSOT nazewnictwa). */

interface DefaultSubSkill {
  key: string;
  label: string;
}

export interface DefaultSkillTreeNode {
  key: string;
  label: string;
  subskills: DefaultSubSkill[];
}

export const DEFAULT_SKILL_TREE: DefaultSkillTreeNode[] = [
  {
    key: 'storytelling',
    label: 'Opowiadanie historii',
    subskills: [
      { key: 'storytelling_hook', label: 'Hook i otwarcie' },
      { key: 'storytelling_concrete', label: 'Konkret zamiast ogólników' },
      { key: 'storytelling_arc', label: 'Łuk narracji i pointa' },
    ],
  },
  {
    key: 'setting',
    label: 'Setting / rozmowa wstępna',
    subskills: [
      { key: 'setting_frame', label: 'Kontrola ramy rozmowy' },
      { key: 'setting_pause', label: 'Pauza po pytaniu' },
      { key: 'setting_fillers', label: 'Mowa bez filerów' },
      { key: 'setting_listening', label: 'Słuchanie i mirroring' },
      { key: 'setting_qualification', label: 'Kwalifikacja / no-fit' },
    ],
  },
  {
    key: 'closing',
    label: 'Closing / domykanie',
    subskills: [
      { key: 'closing_price', label: 'Obiekcja ceny' },
      { key: 'closing_silence', label: 'Cisza po podaniu ceny' },
      { key: 'closing_decision', label: 'Prośba o decyzję' },
    ],
  },
  {
    key: 'negotiation',
    label: 'Negocjacje i granice',
    subskills: [
      { key: 'negotiation_anchor', label: 'Kotwiczenie wartości' },
      { key: 'negotiation_trade', label: 'Zamiana ustępstw' },
      { key: 'negotiation_walkaway', label: 'Gotowość odejść' },
    ],
  },
  {
    key: 'voice_presence',
    label: 'Obecność i głos',
    subskills: [
      { key: 'voice_diction', label: 'Dykcja i artykulacja' },
      { key: 'voice_tone', label: 'Ton, tempo, objętość' },
      { key: 'voice_calm', label: 'Spokój przed mówieniem' },
    ],
  },
  {
    key: 'social_exposure',
    label: 'Ekspozycja społeczna',
    subskills: [
      { key: 'social_initiate', label: 'Inicjowanie kontaktu' },
      { key: 'social_tension', label: 'Mikro-ekspozycja dziennie' },
      { key: 'social_embodied', label: 'Obecność ciałem (wzrok, postawa)' },
    ],
  },
  {
    key: 'deep_work',
    label: 'Deep work i egzekucja',
    subskills: [
      { key: 'work_no_drift', label: 'Pierwszy blok bez ucieczki' },
      { key: 'work_artifact', label: 'Artefakt dnia w świecie' },
      { key: 'work_finish', label: 'Domknięcie zamiast dopieszczania' },
    ],
  },
  {
    key: 'body_base',
    label: 'Ciało i regeneracja',
    subskills: [
      { key: 'body_sleep', label: 'Sen jako baza' },
      { key: 'body_training', label: 'Regularność ruchu' },
      { key: 'body_energy', label: 'Czytanie własnej energii' },
    ],
  },
];

