import type { VeilleItem } from "../types/veille.types"

export const MOCK_VEILLE_DATA: VeilleItem[] = [
    {
        id: "987ce16c-626d-4594-87ac-bd1cce44676a",
        created_at: "2026-02-10T08:35:52.934Z",
        period_start: null,
        period_end: null,
        topic: "évolutions management, droit du travail, obligations employeur, stratégie RH PME France, 7 derniers jours",
        frequency: "weekly",
        source_model: "perplexity/sonar-pro",
        analysis_model: "google/gemini-pro-1.5",
        raw_research:
            '### Actualités importantes des 7 derniers jours (3-10 février 2026) sur les évolutions en management, droit du travail, obligations employeur et stratégie RH pour PME en France\n\nLes principales actualités récentes portent sur le **budget 2026** adopté le 2 février, avec saisine du Conseil constitutionnel le 4 février, impactant directement les obligations des employeurs via des mesures fiscales et sociales comme la prolongation des exonérations sur pourboires, frais de transport et un droit de timbre de 50 € pour les prud\'hommes[1][3][4]. Ce budget maintient la pression sur les coûts fixes sans baisser la CVAE, affectant la masse salariale et les stratégies RH des PME[3].\n\n#### Droit du travail et obligations employeur\n- **Priorité de réembauche en licenciement économique** : L\'employeur doit prouver avoir informé le salarié des postes disponibles ; faute de preuve, il s\'expose à des litiges (publié le 6/02/2026)[1].\n- **Recouvrement URSSAF des contributions conventionnelles** : Pour 8 branches, première échéance les 5 ou 15 février 2026 pour dialogue social et formation professionnelle, déclarées en DSN (publié le 3/02/2026)[1].\n- **BOSS : nouvelle rubrique sur retraites chapeau** : Contenu opposable à l\'administration dès le 4 mai 2026 (publié le 6/02/2026)[1].\n- **Budget 2026 et impacts** : Réforme du chômage, exonérations et apprentissage renforcent les obligations employeurs ; pacte Dutreil durci (durée de conservation des titres à 6 ans)[3][4].\n\n#### Évolutions management et stratégie RH PME\n- Aucune actualité spécifique aux 7 derniers jours sur les stratégies RH dédiées aux PME n\'a été identifiée dans les sources fiables ; les mesures budgétaires (exonérations, CVAE) impactent indirectement les PME via les coûts salariaux et prévisions RH[1][3].\n- France Travail : Revue de presse du 7-9 février mentionne un possible accès aux relevés téléphoniques des allocataires, favorable au ministre du Travail[5] ; budget prévoit -515 postes en 2026[6].\n\n#### Contexte plus large (références récentes <10 jours, applicables 2026)\nBien que légèrement antérieures, des mesures actives en 2026 incluent l\'augmentation des taux d\'allocation partielle (SMIC), indemnités maladie max (dès 1er février) et obligations index égalité (publication 2026 malgré refonte 2027)[1]. La directive européenne sur transparence salariale impose fourchettes de rémunération dans offres d\'emploi et infos sur critères salariaux (transposition en cours, potentiellement pour PME <250 salariés)[2]. Le Medef publie un guide sur transitions/reconversions professionnelles pour accompagner les entreprises[8].',
        executive_summary: `{
  "date_veille": "2026-02-10",
  "periode": "7 derniers jours (3-10 février 2026)",
  "secteurs_cibles": [
    "Management",
    "Droit du travail",
    "Obligations employeur",
    "Stratégie RH",
    "PME",
    "France"
  ],
  "actualites_principales": [
    {
      "titre": "Adoption du Budget 2026 et impacts sur les employeurs",
      "resume": "Le budget 2026, adopté début février, introduit des mesures fiscales et sociales modifiant les obligations des employeurs. Il prolonge certaines exonérations (pourboires, frais de transport) et instaure un droit de timbre de 50 € pour les prud'hommes. La non-baisse de la CVAE maintient la pression sur les coûts fixes et la masse salariale.",
      "date_publication": "2026-02-02",
      "urls": [
        "[1]",
        "[3]",
        "[4]"
      ],
      "mots_cles": [
        "budget 2026",
        "obligations employeur",
        "mesures fiscales",
        "mesures sociales",
        "exonérations",
        "prud'hommes",
        "CVAE"
      ]
    }
  ],
  "sections": [
    {
      "titre": "Droit du travail et obligations employeur",
      "bullet_points": [
        {
          "titre": "Priorité de réembauche en cas de licenciement économique",
          "resume": "Un employeur doit impérativement prouver avoir bien informé le salarié des postes disponibles suite à un licenciement économique. L'absence de preuve expose l'entreprise à des litiges.",
          "date_publication": "2026-02-06",
          "urls": [
            "[1]"
          ],
          "mots_cles": [
            "licenciement économique",
            "priorité de réembauche",
            "obligations employeur",
            "litiges"
          ]
        },
        {
          "titre": "Recouvrement URSSAF des contributions conventionnelles",
          "resume": "Pour 8 branches professionnelles, la première échéance de déclaration et de paiement des contributions conventionnelles au titre du dialogue social et de la formation professionnelle est fixée aux 5 ou 15 février 2026, via la Déclaration Sociale Nominative (DSN).",
          "date_publication": "2026-02-03",
          "urls": [
            "[1]"
          ],
          "mots_cles": [
            "URSSAF",
            "contributions conventionnelles",
            "dialogue social",
            "formation professionnelle",
            "DSN"
          ]
        },
        {
          "titre": "BOSS : nouvelle rubrique sur les retraites chapeau",
          "resume": "Une nouvelle rubrique dédiée aux retraites chapeau est ajoutée au Bulletin Officiel de Sécurité Sociale (BOSS). Ce contenu aura un caractère opposable à l'administration à partir du 4 mai 2026.",
          "date_publication": "2026-02-06",
          "urls": [
            "[1]"
          ],
          "mots_cles": [
            "BOSS",
            "retraites chapeau",
            "opposabilité",
            "administration"
          ]
        },
        {
          "titre": "Impacts du Budget 2026 : chômage, exonérations, apprentissage et pacte Dutreil",
          "resume": "La réforme du chômage, le maintien de certaines exonérations et les mesures concernant l'apprentissage renforcent les obligations des employeurs. Le pacte Dutreil est également durci avec une durée de conservation des titres portée à 6 ans.",
          "date_publication": "2026-02-02",
          "urls": [
            "[3]",
            "[4]"
          ],
          "mots_cles": [
            "budget 2026",
            "chômage",
            "exonérations",
            "apprentissage",
            "pacte Dutreil",
            "obligations employeur"
          ]
        }
      ]
    },
    {
      "titre": "Évolutions management et stratégie RH PME",
      "bullet_points": [
        {
          "titre": "Impact indirect des mesures budgétaires sur les stratégies RH",
          "resume": "Aucune actualité spécifique et récente sur les stratégies RH dédiées aux PME n'a été identifiée dans les sources fiables. Les mesures budgétaires impactent indirectement les PME, notamment via les coûts salariaux et les prévisions RH dues aux évolutions des exonérations et de la CVAE.",
          "date_publication": "2026-02-03",
          "urls": [
            "[1]",
            "[3]"
          ],
          "mots_cles": [
            "stratégie RH",
            "PME",
            "management",
            "budget 2026",
            "coûts salariaux"
          ]
        },
        {
          "titre": "France Travail : accessibilité des données et réduction de postes",
          "resume": "Une revue de presse concernant France Travail mentionne un possible accès aux relevés téléphoniques des allocataires, mesure favorable au ministre du Travail. Le budget prévoit également une réduction de 515 postes pour l'organisme en 2026.",
          "date_publication": "2026-02-07",
          "urls": [
            "[5]",
            "[6]"
          ],
          "mots_cles": [
            "France Travail",
            "données allocataires",
            "budget",
            "postes"
          ]
        }
      ]
    },
    {
      "titre": "Contexte plus large (références récentes <10 jours, applicables 2026)",
      "bullet_points": [
        {
          "titre": "Mesures actives en 2026 : allocation partielle, indemnités maladie, index égalité",
          "resume": "Des mesures déjà actives pour 2026 incluent l'augmentation des taux d'allocation partielle, le plafonnement des indemnités maladie (dès le 1er février) et l'obligation de publication de l'index égalité professionnelle (prévue en 2026 malgré une refonte attendue en 2027).",
          "date_publication": "2026-02-01",
          "urls": [
            "[1]"
          ],
          "mots_cles": [
            "allocation partielle",
            "indemnités maladie",
            "index égalité professionnelle",
            "obligations employeur",
            "2026"
          ]
        },
        {
          "titre": "Directive européenne sur la transparence salariale",
          "resume": "La directive européenne sur la transparence salariale implique l'obligation d'inclure des fourchettes de rémunération dans les offres d'emploi et de fournir des informations sur les critères salariaux. La transposition en France est en cours, avec une application potentielle pour les PME de moins de 250 salariés.",
          "date_publication": "2024-03-01",
          "urls": [
            "[2]"
          ],
          "mots_cles": [
            "directive européenne",
            "transparence salariale",
            "fourchettes rémunération",
            "offres d'emploi",
            "PME",
            "transposition"
          ]
        },
        {
          "titre": "Guide du Medef sur les transitions et reconversions professionnelles",
          "resume": "Le Medef a publié un guide visant à accompagner les entreprises dans les démarches de transitions et de reconversions professionnelles.",
          "date_publication": "2026-01-28",
          "urls": [
            "[8]"
          ],
          "mots_cles": [
            "Medef",
            "transitions professionnelles",
            "reconversion professionnelle",
            "accompagnement entreprises"
          ]
        }
      ]
    }
  ]
}`,
        risks: "",
        opportunities: "",
        recommended_actions: "",
        importance_score: 5,
        tags: [],
        metadata: {
            citations: [
                "https://www.juritravail.com/Actualite/employeurs-quest-ce-que-vous-ne-devez-pas-manquer-en-2026-le-point-sur-les-nouvelles-reformes/Id/378441",
                "https://www.editions-tissot.fr/actualite/droit-du-travail",
                "https://www.legifrance.gouv.fr/jorf/jo",
            ],
        },
    },
]
