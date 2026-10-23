/**
 * Constantes du canevas.
 *
 * Source unique de la géométrie : le moteur de grille les lit en unités,
 * et le canevas les repose en variables CSS inline (`--dash-row`,
 * `--dash-gap`) sur son conteneur. Aucune valeur n'est réécrite en dur
 * dans une classe Tailwind — la géométrie est dynamique, donc elle passe
 * par des variables, comme le faisait déjà `--widget-span`.
 */
export const DASHBOARD_PERMISSIONS = {
    /** Voir le dashboard — permission socle, détenue par tous. */
    view: "dashboard.view",
    /** Éditer les dispositions par défaut d'un rôle ou d'un service. */
    manageTemplates: "dashboard.templates.manage",
} as const

/**
 * Nombre de colonnes de la grille.
 *
 * 12 se divise par 2, 3, 4 et 6 : toutes les fractions utiles (moitié,
 * tiers, quart, deux tiers) tombent juste, ce qu'une grille de 10 ne
 * permet pas.
 */
export const GRID_COLS = 12

/**
 * Hauteur d'une unité de ligne, en pixels.
 *
 * 60 et non 120 : au pas précédent, une carte ne pouvait mesurer que 120
 * ou 240 px, et aucune hauteur intermédiaire n'existait. Un pas deux fois
 * plus fin est la moitié du travail sur la rigidité ressentie ; l'autre
 * moitié est le placement libre.
 */
export const ROW_UNIT = 60

/** Espacement entre modules, en pixels. */
export const GRID_GAP = 16

/**
 * Largeur en dessous de laquelle le canevas passe en colonne unique et
 * en lecture seule (le point de rupture `lg` de Tailwind).
 */
export const EDIT_MIN_WIDTH = 1024

/**
 * Version du format de disposition persisté (colonne `layout.version`).
 *
 * 1 = flux ordonné (`span`/`rows`), 2 = coordonnées (`x`/`y`/`w`/`h`).
 * Une version supérieure à celle-ci est écrite par un front plus récent :
 * on l'ignore plutôt que de la mal interpréter.
 */
export const LAYOUT_VERSION = 2

/** Délai avant écriture en base, en ms — un geste = une écriture. */
export const PERSIST_DEBOUNCE_MS = 600

/** Longueur maximale d'un texte libre stocké dans les réglages. */
export const SETTINGS_TEXT_MAX = 4000

/**
 * Hauteur maximale d'un module, en unités de ligne.
 *
 * Ce n'est pas une contrainte de design : les modules n'ont plus de
 * plafond déclaré, c'est tout l'objet de la refonte. C'est un garde-fou —
 * il empêche qu'un geste aberrant ou une ligne corrompue en base ne
 * produise un canevas de cent mille pixels de haut.
 */
export const MAX_ROWS = 40

/**
 * Largeur minimale d'un module, en colonnes, quand il n'en déclare pas.
 *
 * Deux et non une : sur douze colonnes, une seule colonne fait moins de
 * cent pixels — aucun des modules n'y rend quoi que ce soit de lisible,
 * et l'y autoriser reviendrait à proposer un geste qui ne produit que du
 * vide.
 */
export const MIN_COLS = 2

/**
 * Hauteur minimale d'un module, en unités de ligne, à défaut de
 * déclaration. Une seule ligne fait 60 px : de quoi loger un en-tête et
 * rien d'autre.
 */
export const MIN_ROWS = 2
