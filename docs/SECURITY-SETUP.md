# Bootstrap du garde-fou « revue sécurité au commit »

> **Doc versionnée (committée).** Présente sur tout PC après `git clone` — indépendante de pCloud.
> Elle explique comment (re)configurer **à l'identique** le dispositif qui impose une revue sécurité
> avant chaque `git commit`.
>
> Les **constats** de revue ne sont **pas** ici : ils vivent dans `docs/SECURITY.md` (gitignoré, hors
> dépôt, jamais poussé). Ce fichier-ci ne contient que le *processus* et l'outillage (non sensibles).

## Combo à 2 piliers

- **Pilier 1 — garde-fou (hook)** : déterministe, exécuté par le harness Claude Code **avant** `git commit`.
  Il **bloque** le commit (`permissionDecision:"deny"`) tant que la revue du diff courant n'est pas
  consignée. Anti-boucle via l'empreinte du diff mémorisée dans `.claude/.security-reviewed`.
- **Pilier 2 — routine** documentée dans `CLAUDE.md` (committé) : l'assistant fait la revue et écrit une
  entrée datée dans `docs/SECURITY.md`. Reste **due même si le hook est absent/désactivé** → c'est le filet.

## 1. Ce qui arrive déjà par `git clone` (rien à recréer)

- **`CLAUDE.md`** : routine « Revue sécurité avant chaque commit » + ligne « S — SECURITY.md » du
  « Rapport de fin de release ». (Committé.)
- **`.gitignore`** : ignore `.claude/`, `docs/SECURITY.md`, `*.bak`, `node_modules/`…
  Vérifier : `git check-ignore .claude/settings.json docs/SECURITY.md` doit renvoyer les deux chemins.
- **`docs/SECURITY-SETUP.md`** : ce fichier.

## 2. Fichiers à recréer (gitignorés → absents après un clone)

Prérequis : **Git Bash** (le hook tourne en `bash`). `node` utile seulement pour la vérif §4.
Contenu **verbatim** — recréer tel quel. (En cas de modification du hook plus tard, **mettre ce fichier à jour**.)

### a) `.claude/hooks/security-gate.sh`

```bash
#!/usr/bin/env bash
# Garde-fou "revue securite avant commit" — hook PreToolUse (matcher Bash, filtre if=Bash(git commit*)).
# Bloque un `git commit` tant qu'une revue securite du diff courant n'a pas ete consignee dans docs/SECURITY.md.
# Anti-boucle : on memorise l'empreinte du diff revu dans .claude/.security-reviewed ; tant que le diff ne
# change pas, une fois la revue faite, le commit passe. Nouveau diff => nouvelle revue exigee.
#
# Sortie : rien + exit 0  => laisse passer.  JSON permissionDecision=deny + exit 0 => bloque avec consigne.
# Fail-open : toute anomalie => on laisse passer (on ne veut pas bricker les commits sur un bug de hook).

set -uo pipefail

proj="${CLAUDE_PROJECT_DIR:-}"
if [ -z "$proj" ]; then
  proj="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
fi
cd "$proj" 2>/dev/null || exit 0   # pas un repo exploitable => ne bloque pas

sentinel="$proj/.claude/.security-reviewed"

# Empreinte de ce qui va etre commite (index + modifications suivies non indexees).
# SECURITY.md et .claude/ sont gitignores => les ecrire ne change pas cette empreinte (stable sur retry).
h="$( { git diff --cached; git diff; } 2>/dev/null | git hash-object --stdin 2>/dev/null )"
[ -z "$h" ] && h="none"

# Deja revu pour cet etat exact => on laisse passer.
if [ -f "$sentinel" ] && [ "$(cat "$sentinel" 2>/dev/null)" = "$h" ]; then
  exit 0
fi

reason="REVUE SECURITE REQUISE avant ce commit. (1) Analyser 'git diff HEAD' : fuite ou log du token Notion, CSP + innerHTML/XSS, message passing popup<->service worker, injection de champs Notion, permissions MV3 / host_permissions, secrets en clair. (2) Consigner dans docs/SECURITY.md une entree datee : perimetre du diff, constats classes Haut/Moyen/Bas, statut (corrige / a suivre / accepte). (3) Valider la revue : echo ${h} > .claude/.security-reviewed (4) Relancer le commit."

printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s"}}\n' "$reason"
exit 0
```

### b) `.claude/settings.json`

> Si un `.claude/settings.json` existe déjà (autres réglages), **fusionner** la clé `hooks.PreToolUse`
> sans écraser le reste.

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "shell": "bash",
            "if": "Bash(git commit*)",
            "command": "bash \"$(git rev-parse --show-toplevel)/.claude/hooks/security-gate.sh\"",
            "timeout": 30,
            "statusMessage": "Garde-fou revue securite…"
          }
        ]
      }
    ]
  }
}
```

### c) `docs/SECURITY.md` (registre — à initialiser)

Fichier gitignoré : sur un PC neuf, l'initialiser à partir de ce squelette minimal (le hook exige juste
qu'il existe et qu'on y consigne les revues). Récupérer la version pCloud si disponible, sinon repartir de :

````markdown
# SECURITY.md — Suivi sécurité interne

> Hors dépôt (gitignoré). Registre des revues de sécurité + points ouverts.
> Bootstrap du dispositif : voir `docs/SECURITY-SETUP.md` (versionné).

## Format d'une entrée
```
### AAAA-MM-JJ — <version ou résumé du diff>
- Périmètre : fichiers/zones analysés.
- Constats : [Haut] … / [Moyen] … / [Bas] … (fichier:ligne — impact — action).
- Statut : corrigé / à suivre / risque accepté (justification).
```

## Grille (Chrome MV3 + Notion)
Token Notion (jamais loggé/en URL) · innerHTML/XSS · CSP · message passing popup↔SW ·
injection de champs Notion · permissions MV3/host_permissions · secrets en dur.

## Registre des revues
_(vide)_

## Points ouverts (non corrigés)
_(vide)_
````

## 3. Activation

1. **`/hooks`** dans Claude Code (recharge la config) **ou** redémarrer Claude Code. Indispensable si
   `.claude/` n'existait pas au démarrage de la session (le watcher ne surveille pas un dossier apparu en
   cours de route) → sinon le hook ne se déclenche pas.
2. **Approuver / faire confiance** au hook du projet quand Claude Code le demande.

## 4. Vérification (facultatif)

Depuis la racine, dans Git Bash :

```bash
GATE=.claude/hooks/security-gate.sh
h="$( { git diff --cached; git diff; } | git hash-object --stdin )"

rm -f .claude/.security-reviewed; bash "$GATE"          # 1) sans revue => JSON permissionDecision:"deny"
echo "$h" > .claude/.security-reviewed; bash "$GATE"; echo "rc=$?"   # 2) revue OK => rien, exit 0
rm -f .claude/.security-reviewed                         # 3) réarmer le garde-fou
node -e 'JSON.parse(require("fs").readFileSync(".claude/settings.json","utf8")); console.log("settings.json OK")'
```

## 5. Fonctionnement au quotidien

Quand un `git commit` est bloqué : lire la consigne → analyser `git diff HEAD` (grille §2c) → consigner
l'entrée datée dans `docs/SECURITY.md` → `echo <hash> > .claude/.security-reviewed` (le hash est fourni
dans le message de blocage) → relancer le commit (il passe).

## 6. Limites

- Ne couvre que les commits faits **via l'assistant** (Claude Code). Un `git commit` tapé **manuellement**
  dans un terminal n'est pas intercepté (il faudrait un hook git natif `.git/hooks/pre-commit`, limité à un
  scan déterministe, pas une revue IA).
- La config du dispositif (`.claude/`, `docs/SECURITY.md`) est **gitignorée** : elle ne suit pas le clone.
  D'où ce fichier versionné pour la reconstruire. Ne jamais committer le **contenu des constats**.
