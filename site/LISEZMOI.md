# Maquette — Cléa-Chantal Léandri

Site statique (aucun serveur, aucune dépendance) : `index.html` + `css/` + `js/` + `assets/`.

- Voir en local : `python -m http.server 5173 --directory site` puis http://localhost:5173
- `js/paint.js` : toile interactive du hero (WebGL). `?nogl` dans l'URL la désactive (image statique).
- `js/main.js` : menu, galerie filtrable, visionneuse, expositions, formulaire (ouvre la messagerie, pas de back-end).
- `assets/works.js` : liste des œuvres par catégorie (ids d'images). Images : `assets/img/t` (miniatures) et `assets/img/w` (grand format).
- Textes, prix, expositions : en dur dans `index.html`, repris du site d'origine.

## Repérage du code
Chaque fichier commence par un sommaire et découpe ses sections avec un marqueur `## NOM`
(`<!-- ## HERO -->` en HTML, `/* ## HERO */` en CSS/JS). Les mêmes noms servent dans les 3 fichiers
(HEADER, HERO, ARTISTE, OEUVRES, EXPOSITIONS, ATELIER, CONTACT-PRIX, FOOTER, VISIONNEUSE).
Recherche : `grep -n "## " site/js/paint.js`.

## Prix
Masqués pour l'instant : le tableau est conservé en commentaire dans `index.html` (section CONTACT-PRIX) ; les styles `.prices` sont toujours dans le CSS.

## Déploiement
Push sur `main` (GitHub: AntoniceG/clea-leandri-maquette) = déploiement automatique sur Vercel (dossier racine : `site`, accès protégé).
