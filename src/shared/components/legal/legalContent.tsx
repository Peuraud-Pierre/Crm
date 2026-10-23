/**
 * Version du texte légal. Bumper ce numéro lors d'une
 * modification matérielle des politiques ou mentions :
 * tous les utilisateurs seront alors invités à re-accepter.
 */
export const PRIVACY_VERSION = "1.0"

/**
 * Libellé d'affichage de la version, tel qu'imposé par les
 * conditions (« Version des conditions : V1.0 »).
 */
export const PRIVACY_VERSION_LABEL = "V1.0"

/**
 * Date de dernière mise à jour — purement informative,
 * affichée à l'utilisateur dans l'en-tête du dialogue.
 */
export const PRIVACY_LAST_UPDATED = "13 mai 2026"

export type LegalStepKey = "charte" | "donnees" | "conduite" | "ia"

export const LEGAL_STEPS: {
    key: LegalStepKey
    title: string
    shortTitle: string
    checkboxLabel: string
}[] = [
    {
        key: "charte",
        title: "Charte d'Utilisation Informatique",
        shortTitle: "Charte & Sécurité",
        checkboxLabel:
            "J'ai lu et j'accepte les conditions de sécurité et de propriété.",
    },
    {
        key: "donnees",
        title: "Protection des Données Personnelles (RGPD)",
        shortTitle: "Données personnelles",
        checkboxLabel:
            "L'utilisateur reconnaît avoir été informé du traitement de ses données personnelles et de la traçabilité des accès.",
    },
    {
        key: "conduite",
        title: "Code de Bonne Conduite",
        shortTitle: "Bonne conduite",
        checkboxLabel:
            "L'utilisateur s'engage à respecter les règles de déontologie, de confidentialité et de bonne conduite.",
    },
    {
        key: "ia",
        title: "Assistance par Intelligence Artificielle",
        shortTitle: "Assistance IA",
        checkboxLabel:
            "L'utilisateur reconnaît avoir été informé des conditions d'utilisation des fonctionnalités d'Intelligence Artificielle et s'engage à les respecter.",
    },
]

export function CharteInformatiqueContent() {
    return (
        <div className="space-y-6 text-sm leading-relaxed">
            <section>
                <h2 className="text-base font-semibold mb-2">
                    Cadre d'utilisation et Sécurité
                </h2>
                <p>
                    En accédant à La Console NOKK_PROJECT, outil propriétaire
                    développé et exploité par la société Les Chiffonniers
                    de Nokk_project, l'utilisateur reconnaît et accepte les
                    conditions suivantes&nbsp;:
                </p>
            </section>

            <section>
                <h2 className="text-base font-semibold mb-2">
                    Propriété intellectuelle
                </h2>
                <p>
                    Cet outil, son code source, son architecture et son
                    interface sont la propriété exclusive de Les Chiffonniers
                    de Nokk_project et sont protégés au titre de la propriété
                    intellectuelle. Toute tentative d'extraction massive de
                    données, de rétro-ingénierie, de copie ou de reproduction
                    est strictement interdite et passible de poursuites.
                </p>
            </section>

            <section>
                <h2 className="text-base font-semibold mb-2">
                    Accès personnel et sécurité
                </h2>
                <p>
                    L'accès est strictement personnel et protégé par une
                    authentification à deux facteurs (2FA). L'utilisateur est
                    seul responsable de la confidentialité de ses identifiants.
                    Tout partage des accès est formellement interdit.
                </p>
            </section>

            <section>
                <h2 className="text-base font-semibold mb-2">
                    Usage professionnel
                </h2>
                <p>
                    L'outil est mis à disposition exclusivement dans le cadre
                    des missions professionnelles de l'utilisateur. Tout usage
                    à des fins personnelles est interdit et ne saurait
                    compromettre la sécurité ou les performances du système.
                    Toute tentative d'intrusion ou de test de vulnérabilité non
                    autorisé est strictement proscrite.
                </p>
            </section>

            <section>
                <h2 className="text-base font-semibold mb-2">
                    Intégrité du système
                </h2>
                <p>
                    Il est strictement interdit de tenter de modifier,
                    contourner, saturer ou compromettre le fonctionnement de
                    l'outil par quelque moyen que ce soit (injection de données,
                    tentatives de surcharge, manipulation des appels API,
                    exploitation de failles). Toute action visant à perturber,
                    interrompre ou altérer la disponibilité ou l'intégrité du
                    système, même à titre d'essai, pourra donner lieu à des
                    sanctions disciplinaires internes ainsi qu'à des poursuites
                    judiciaires, conformément aux dispositions légales en
                    vigueur.
                </p>
            </section>

            <section>
                <h2 className="text-base font-semibold mb-2">
                    Verrouillage de session
                </h2>
                <p>
                    L'utilisateur s'engage à verrouiller sa session ou à se
                    déconnecter de l'outil dès lors qu'il quitte son poste de
                    travail, même temporairement. Toute action effectuée depuis
                    une session ouverte et non surveillée engage sa
                    responsabilité. En cas de doute sur une utilisation non
                    autorisée de sa session, l'utilisateur doit immédiatement le
                    signaler à l'adresse suivant&nbsp;:{" "}
                    <a
                        href="mailto:informatique@nokk-project.example"
                        className="underline"
                    >
                        informatique@nokk-project.example
                    </a>
                    .
                </p>
            </section>

            <section>
                <h2 className="text-base font-semibold mb-2">
                    Conformité des terminaux
                </h2>
                <p>
                    L'utilisateur s'engage à n'accéder à l'outil que depuis des
                    équipements fournis ou explicitement autorisés par Les
                    Chiffonniers de Nokk_project.
                </p>
            </section>

            <section>
                <h2 className="text-base font-semibold mb-2">
                    Sécurité des périphériques
                </h2>
                <p>
                    Il est interdit de connecter au poste de travail utilisé
                    pour accéder à La Console NOKK_PROJECT tout périphérique externe
                    (clé USB, disque dur, adaptateur, ou tout autre dispositif
                    de stockage ou de connexion) dont l'origine n'est pas
                    certifiée ou qui n'a pas été préalablement vérifié et
                    autorisé par le service informatique. Tout périphérique
                    d'origine inconnue ou douteuse doit être remis au service
                    informatique sans être connecté.
                </p>
            </section>

            <section>
                <h2 className="text-base font-semibold mb-2">Signalement</h2>
                <p>
                    Toute anomalie, tentative d'intrusion ou comportement
                    suspect doit être signalé immédiatement à l'adresse&nbsp;:{" "}
                    <a
                        href="mailto:informatique@nokk-project.example"
                        className="underline"
                    >
                        informatique@nokk-project.example
                    </a>
                    .
                </p>
            </section>

            <section>
                <p>
                    Ces conditions constituent un résumé des règles essentielles
                    de sécurité. Pour toute information complémentaire, veuillez
                    vous référer à la Charte Informatique de Les Chiffonniers
                    de Nokk_project.
                </p>
            </section>
        </div>
    )
}

export function DonneesPersonnellesContent() {
    return (
        <div className="space-y-6 text-sm leading-relaxed">
            <section>
                <h2 className="text-base font-semibold mb-2">
                    Traitement et confidentialité de vos données
                </h2>
                <p>
                    Conformément au Règlement Général sur la Protection des
                    Données (RGPD — UE 2016/679), la société Les Chiffonniers
                    de Nokk_project, dont le siège social est situé 12 rue de l'Exemple, 75000 Paris, agissant en qualité de
                    responsable du traitement, informe l'utilisateur de ce qui
                    suit&nbsp;:
                </p>
            </section>

            <section>
                <h2 className="text-base font-semibold mb-2">
                    Source des données
                </h2>
                <p>
                    Cet outil consulte et affiche des données (clients,
                    commandes, fiches tiers) extraites de l'ERP Proginov via son
                    API officielle. En cas de divergence entre les données
                    affichées et celles de l'ERP, les données de l'ERP font
                    seules foi.
                </p>
            </section>

            <section>
                <h2 className="text-base font-semibold mb-2">
                    Finalités du traitement
                </h2>
                <p>
                    Les données traitées ont pour finalité la gestion de la
                    relation client (CRM), le suivi commercial, la gestion de
                    projets internes et la communication entre collaborateurs.
                </p>
            </section>

            <section>
                <h2 className="text-base font-semibold mb-2">Traçabilité</h2>
                <p>
                    Pour des raisons de sécurité informatique, les logs de
                    connexion (horodatage, identifiant utilisateur) ainsi que
                    les actions critiques (modification ou suppression de fiches
                    clients, exports) sont enregistrés et conservés pendant une
                    durée de 12 mois.
                </p>
            </section>

            <section>
                <h2 className="text-base font-semibold mb-2">
                    Données concernant l'utilisateur
                </h2>
                <p>
                    Dans le cadre de l'utilisation de l'outil, les données
                    professionnelles de l'utilisateur (nom, prénom, adresse mail
                    professionnelle, logs d'activité) sont traitées pour les
                    besoins de gestion interne et de sécurité.
                </p>
            </section>

            <section>
                <h2 className="text-base font-semibold mb-2">
                    Droits de l'utilisateur
                </h2>
                <p>
                    Conformément au RGPD, l'utilisateur dispose d'un droit
                    d'accès, de rectification et d'opposition aux données le
                    concernant. Pour exercer ces droits, contacter&nbsp;:{" "}
                    <a href="mailto:servicerh@nokk-project.example" className="underline">
                        servicerh@nokk-project.example
                    </a>
                    .
                </p>
            </section>

            <section>
                <p>
                    Ces informations constituent un résumé des droits et
                    obligations en matière de données personnelles. Pour toute
                    information complémentaire, veuillez vous référer à la
                    Politique de Protection des Données (RGPD) de Les
                    Chiffonniers de Nokk_project.
                </p>
            </section>
        </div>
    )
}

export function BonneConduiteContent() {
    return (
        <div className="space-y-6 text-sm leading-relaxed">
            <section>
                <h2 className="text-base font-semibold mb-2">
                    Éthique, CRM et messagerie interne
                </h2>
                <p>
                    Afin de garantir la qualité des données, la sécurité des
                    informations clients et le respect de chacun au sein de Les
                    Chiffonniers de Nokk_project, l'utilisateur s'engage à
                    respecter les règles suivantes&nbsp;:
                </p>
            </section>

            <section>
                <h2 className="text-base font-semibold mb-2">
                    Qualité et intégrité des données CRM
                </h2>
                <p>
                    Les commentaires et notes saisis dans les fiches clients
                    doivent être factuels, professionnels et dépourvus de tout
                    jugement de valeur ou propos subjectif. Des informations
                    inexactes ou non professionnelles engagent la responsabilité
                    de l'utilisateur.
                </p>
            </section>

            <section>
                <h2 className="text-base font-semibold mb-2">
                    Interdiction d'export
                </h2>
                <p>
                    L'extraction ou l'exportation de tout ou partie de la base
                    de données clients, à des fins personnelles, de stockage
                    externe ou au profit d'un tiers, est strictement interdite.
                    Cette infraction pourra donner lieu à des sanctions
                    disciplinaires internes ainsi qu'à des poursuites
                    judiciaires, conformément aux dispositions légales en
                    vigueur.
                </p>
            </section>

            <section>
                <h2 className="text-base font-semibold mb-2">Confidentialité</h2>
                <p>
                    Les informations consultées via l'outil (coordonnées
                    clients, historiques de commandes, conditions commerciales,
                    remises accordées, données stratégiques) sont strictement
                    confidentielles et ne doivent pas être divulguées à des
                    tiers sans autorisation expresse de la direction.
                </p>
            </section>

            <section>
                <h2 className="text-base font-semibold mb-2">
                    Messagerie interne
                </h2>
                <p>
                    Les échanges via la messagerie interne doivent rester
                    courtois et professionnels. Tout propos harcelant,
                    discriminatoire ou injurieux est strictement interdit et
                    pourra donner lieu à des sanctions conformément au Règlement
                    Intérieur de Les Chiffonniers de Nokk_project.
                </p>
            </section>

            <section>
                <h2 className="text-base font-semibold mb-2">
                    Périmètre d'accès
                </h2>
                <p>
                    L'utilisateur s'engage à n'accéder qu'aux données relevant
                    de son périmètre de responsabilité. Toute tentative d'accès
                    à des modules ne relevant pas de son rôle doit immédiatement
                    être signalée au service informatique.
                </p>
            </section>

            <section>
                <p>
                    Ces règles constituent un résumé des engagements attendus
                    dans l'utilisation de l'outil. Pour toute information
                    complémentaire, veuillez vous référer au Règlement Intérieur
                    de Les Chiffonniers de Nokk_project.
                </p>
            </section>
        </div>
    )
}

export function IAContent() {
    return (
        <div className="space-y-6 text-sm leading-relaxed">
            <section>
                <h2 className="text-base font-semibold mb-2">
                    Utilisation des fonctionnalités d'IA
                </h2>
                <p>
                    L'outil intègre des fonctionnalités d'assistance basées sur
                    des modèles de langage et de génération d'images
                    (Intelligence Artificielle), ainsi que tout autre module IA
                    qui pourrait être intégré ultérieurement.
                </p>
                <p className="mt-2">
                    L'utilisateur reconnaît et accepte les conditions
                    suivantes&nbsp;:
                </p>
            </section>

            <section>
                <h2 className="text-base font-semibold mb-2">
                    Usage strictement professionnel
                </h2>
                <p>
                    L'accès à ces fonctionnalités est réservé exclusivement à
                    l'exercice des missions de l'utilisateur au sein de Les
                    Chiffonniers de Nokk_project. Tout usage à des fins
                    personnelles est strictement interdit.
                </p>
            </section>

            <section>
                <h2 className="text-base font-semibold mb-2">
                    Obligation de vigilance
                </h2>
                <p>
                    La société met en œuvre les moyens techniques nécessaires
                    pour assurer la fiabilité des modèles mis à disposition.
                    Toutefois, ces technologies peuvent produire des résultats
                    inexacts ou incomplets, y compris sur le plan visuel
                    (communément appelés «&nbsp;hallucinations&nbsp;»).
                    L'utilisateur est tenu de procéder à une vérification
                    systématique des contenus générés, textes comme images,
                    avant toute exploitation ou diffusion.
                </p>
            </section>

            <section>
                <h2 className="text-base font-semibold mb-2">Contrôle humain</h2>
                <p>
                    L'outil est conçu comme un support aux missions de
                    l'utilisateur et ne remplace en aucun cas son expertise
                    métier. Il appartient à l'utilisateur de valider la
                    véracité, la pertinence et la conformité des contenus
                    produits avant toute exploitation ou diffusion.
                </p>
            </section>

            <section>
                <h2 className="text-base font-semibold mb-2">
                    Responsabilité éditoriale
                </h2>
                <p>
                    Tout contenu généré, textuel ou visuel, validé et exploité
                    par l'utilisateur dans le cadre de ses fonctions engage sa
                    responsabilité professionnelle.
                </p>
            </section>

            <section>
                <h2 className="text-base font-semibold mb-2">Usage loyal</h2>
                <p>
                    L'utilisateur s'engage à utiliser ces fonctionnalités dans
                    leur cadre prévu et à ne pas tenter de les détourner,
                    notamment par toute tentative de contournement des
                    restrictions d'usage (prompt injection, extraction de
                    données système, génération de contenus illicites ou
                    contraires aux valeurs de l'entreprise).
                </p>
            </section>

            <section>
                <p>
                    Ces règles constituent un résumé des engagements attendus
                    dans l'utilisation des fonctionnalités d'Intelligence
                    Artificielle. Pour toute information complémentaire, veuillez
                    vous référer à la Charte Informatique de Les Chiffonniers
                    de Nokk_project.
                </p>
            </section>
        </div>
    )
}
