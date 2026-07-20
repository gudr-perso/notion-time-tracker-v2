# Bootstrap des garde-fous du projet

> **Doc versionnée (committée).** Présente sur tout PC après `git clone` — indépendante de pCloud.
> Elle explique comment (re)configurer **à l'identique** les garde-fous locaux du projet.
> *(Anciennement `SECURITY-SETUP.md` ; renommé `SETUP.md` car il couvre désormais tous les garde-fous, pas que la sécurité.)*
>
> Les **constats** de revue sécurité ne sont **pas** ici : ils vivent dans `docs/SECURITY.md`
> (gitignoré, hors dépôt, jamais poussé). Ce fichier-ci ne contient que le *processus* et l'outillage.

## Vue d'ensemble — 2 garde-fous, même patron

Deux hooks `PreToolUse` (matcher `Bash`, filtre `if=Bash(git commit*)`) exécutés par le harness Claude Code
avant `git commit`. Chacun double une **routine `CLAUDE.md`** (model-driven) par un **garde-fou déterministe** :

- **Garde-fou 1 — revue sécurité** (`security-gate.sh`) : **bloque** le commit tant qu'une revue sécurité
  du diff courant n'est pas consignée dans `docs/SECURITY.md`. Anti-boucle via `.claude/.security-reviewed`.
- **Garde-fou 2 — release / brique V de AVEC** (`release-gate.sh`) : ne s'active **que sur un bump de
  version** (manifest.json ≠ HEAD). **Bloque** (checks durs, mécaniques) si `package.json`/`package-lock.json`
  ne sont pas à la même version, ou si `VERSIONS.md`/`AVANCEMENT.md` n'ont pas la version. **Rappels doux**
  (non bloquants) pour D² (doc non touchée alors que `src/` a changé) et EVENEMENTS.md.

Principe : un hook n'enforce que des **conditions mécaniques** ; les jugements (bug « non trivial »,
« impact » doc) restent des **routines** dans `CLAUDE.md`, au plus rappelés en douceur.

## 1. Ce qui arrive déjà par `git clone` (rien à recréer)

- **`CLAUDE.md`** : routines « revue sécurité avant chaque commit » et « nouvelle version décidée »
  (+ ligne « S » du Rapport de fin de release). Committé.
- **`.gitignore`** : ignore `.claude/`, `docs/SECURITY.md`, `*.bak`, `node_modules/`…
  Vérifier : `git check-ignore .claude/settings.json docs/SECURITY.md` doit renvoyer les deux chemins.
- **`docs/SETUP.md`** : ce fichier.

## 2. Fichiers à recréer (gitignorés → absents après un clone)

Prérequis : **Git Bash** (les hooks tournent en `bash`). `node` utile seulement pour la vérif §4.
Contenu **verbatim** — recréer tel quel. **En cas de modification d'un hook plus tard, mettre ce fichier à jour.**

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

# Auto-filtre : ne s'active que sur un vrai `git commit` (lit la commande depuis le JSON du hook sur stdin).
# Neutralise les faux positifs : meme si le filtre `if` du settings.json declenche le hook par precaution
# sur une commande complexe, on sort en "laisser passer" pour tout ce qui n'est pas un git commit.
case "$(cat 2>/dev/null)" in
  *"git commit"*) : ;;
  *) exit 0 ;;
esac

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

### b) `.claude/hooks/release-gate.sh`

```bash
#!/usr/bin/env bash
# Gate release (brique V de la methode AVEC) — hook PreToolUse (matcher Bash, filtre if=Bash(git commit*)).
# Ne se declenche QUE si la version de manifest.json (working tree) differe de HEAD (= une release est en cours).
#
# Checks DURS (bloquants, purement mecaniques) :
#   - package.json et package-lock.json a la MEME version que manifest.json
#   - VERSIONS.md contient une section pour cette version
#   - AVANCEMENT.md mentionne cette version
# Rappels DOUX (non bloquants, systemMessage) :
#   - D2 : du code (src/) a change mais documentation-technique/fonctionnelle.md n'ont pas bouge
#   - EVENEMENTS.md : rappel de penser a une entree si un bug non trivial a ete corrige
#   - Revue de code : rappel de passer /code-review sur le diff si du code (src/) a change
#
# Fail-open : toute anomalie => laisse passer (exit 0 sans sortie). On ne bloque jamais sur un bug de hook.

set -uo pipefail

# Auto-filtre : ne s'active que sur un vrai `git commit` (lit la commande depuis le JSON du hook sur stdin).
# Neutralise les faux positifs : meme si le filtre `if` du settings.json declenche le hook par precaution
# sur une commande complexe, on sort en "laisser passer" pour tout ce qui n'est pas un git commit.
case "$(cat 2>/dev/null)" in
  *"git commit"*) : ;;
  *) exit 0 ;;
esac

proj="${CLAUDE_PROJECT_DIR:-}"
[ -z "$proj" ] && proj="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$proj" 2>/dev/null || exit 0

ver_file() { grep -m1 '"version"' "$1" 2>/dev/null | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/'; }
ver_head() { git show "HEAD:$1" 2>/dev/null | grep -m1 '"version"' | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/'; }

new="$(ver_file manifest.json)"
old="$(ver_head manifest.json)"

[ -z "$new" ] && exit 0            # version illisible => on ne fait rien
[ "$new" = "$old" ] && exit 0      # pas de bump => pas une release => rien a verifier

# --- Checks DURS ---
fails=""
[ "$(ver_file package.json)" = "$new" ]      || fails="${fails} package.json != $new;"
[ "$(ver_file package-lock.json)" = "$new" ] || fails="${fails} package-lock.json != $new;"
grep -qF "$new" docs/VERSIONS.md 2>/dev/null   || fails="${fails} VERSIONS.md sans section $new;"
grep -qF "$new" docs/AVANCEMENT.md 2>/dev/null || fails="${fails} AVANCEMENT.md ne mentionne pas $new;"

if [ -n "$fails" ]; then
  reason="RELEASE v$new INCOMPLETE (brique V de AVEC). A corriger avant ce commit :${fails} Routine : bumper manifest + package + package-lock a $new, ajouter la section $new dans VERSIONS.md, refleter $new dans AVANCEMENT.md, puis relancer le commit."
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s"}}\n' "$reason"
  exit 0
fi

# --- Rappels DOUX (non bloquants) ---
changed="$(git diff --name-only HEAD 2>/dev/null)"
notes=""
if echo "$changed" | grep -qE '^src/' && ! echo "$changed" | grep -qE 'documentation-(technique|fonctionnelle)\.md'; then
  notes="${notes} D2: du code (src/) a change mais documentation-technique/fonctionnelle.md n'ont pas bouge — verifier l'impact (ou n/a).";
fi
echo "$changed" | grep -qF 'docs/EVENEMENTS.md' || notes="${notes} E: si un bug non trivial a ete corrige dans cette version, penser a une entree EVENEMENTS.md.";
echo "$changed" | grep -qE '^src/' && notes="${notes} R: du code (src/) a change — passer /code-review sur le diff de la version avant de figer la release.";

if [ -n "$notes" ]; then
  printf '{"systemMessage":"Release v%s — rappels non bloquants :%s"}\n' "$new" "$notes"
fi
exit 0
```

### c) `.claude/settings.json`

> Si le fichier existe déjà (autres réglages), **fusionner** sans écraser le reste.

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
          },
          {
            "type": "command",
            "shell": "bash",
            "if": "Bash(git commit*)",
            "command": "bash \"$(git rev-parse --show-toplevel)/.claude/hooks/release-gate.sh\"",
            "timeout": 30,
            "statusMessage": "Garde-fou release (versions/VERSIONS/AVANCEMENT)…"
          }
        ]
      }
    ]
  }
}
```

### d) `docs/SECURITY.md` (registre — à initialiser)

Fichier gitignoré : sur un PC neuf, l'initialiser à partir de ce squelette (le hook exige juste qu'il
existe et qu'on y consigne les revues). Récupérer la version pCloud si disponible, sinon repartir de :

````markdown
# SECURITY.md — Suivi sécurité interne (registre)

> Hors dépôt (gitignoré). Registre des revues de sécurité + points ouverts.
> Bootstrap du dispositif : voir `docs/SETUP.md` (versionné).

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
   cours de route) → sinon les hooks ne se déclenchent pas.
2. **Approuver / faire confiance** aux hooks du projet quand Claude Code le demande.

## 4. Vérification (facultatif)

Depuis la racine, dans Git Bash :

```bash
# Gate securite : sans revue => JSON deny ; revue validee => rien (exit 0)
h="$( { git diff --cached; git diff; } | git hash-object --stdin )"
rm -f .claude/.security-reviewed; bash .claude/hooks/security-gate.sh
echo "$h" > .claude/.security-reviewed; bash .claude/hooks/security-gate.sh; echo "rc=$?"
rm -f .claude/.security-reviewed

# Gate release : sans bump (working == HEAD) => rien. (Test complet du blocage : voir un bac a sable.)
bash .claude/hooks/release-gate.sh; echo "rc=$?"

# settings.json valide + 2 hooks
node -e 'const j=require("./.claude/settings.json"); console.log("hooks:", j.hooks.PreToolUse[0].hooks.length)'
```

## 5. Fonctionnement au quotidien

### 5.1 Gate sécurité (à chaque commit)

Commit bloqué → lire la consigne → analyser `git diff HEAD` (grille §2d) → consigner l'entrée datée dans
`docs/SECURITY.md` → `echo <hash> > .claude/.security-reviewed` (hash fourni dans le blocage) → relancer.

### 5.2 Gate release (au bump de version)

Commit de release bloqué → compléter ce qui manque (versions `package`/`package-lock`, section `VERSIONS.md`,
mention `AVANCEMENT.md`) → relancer (se résout tout seul, pas de sentinel). Les **rappels doux** (D², É)
s'affichent en `systemMessage` sans bloquer — à traiter ou marquer n/a.

## 6. Limites

- Ne couvre que les commits faits **via l'assistant** (Claude Code). Un `git commit` tapé **manuellement**
  dans un terminal n'est pas intercepté (il faudrait un hook git natif `.git/hooks/pre-commit`).
- Le déclenchement combine le filtre `if` (`settings.json`) et l'**auto-filtre du script** (présence de
  `git commit` dans la commande, lue sur stdin) → couvre aussi les formes chaînées ; préférer tout de même
  un `git commit` **autonome** par sûreté.
- La config (`.claude/`, `docs/SECURITY.md`) est **gitignorée** : elle ne suit pas le clone. D'où ce fichier
  versionné pour la reconstruire. Ne jamais committer le **contenu des constats**.

## 7. Prompts de reprise (à coller sur un autre PC)

Deux scénarios, deux prompts à coller dans Claude Code selon le cas. Ils s'appuient sur ce fichier comme
source de vérité (ils suivent les §2–§4) — rien de recopié qui pourrait dériver.

### 7.1 · Phaser un PC neuf (dossier vide)

```text
Bootstrap CAP⁴ de ce projet sur un PC neuf (ce dossier est vide).

1. Clone le dépôt ici : git clone https://github.com/gudr-perso/notion-time-tracker-v2.git .
2. Installe les dépendances de test : npm install
3. Lis docs/SETUP.md et reconstruis les garde-fous locaux EXACTEMENT d'après lui (§2) :
   - .claude/hooks/security-gate.sh et .claude/hooks/release-gate.sh (contenu verbatim),
   - .claude/settings.json (verbatim),
   - docs/SECURITY.md à partir du squelette de SETUP.md §2d.
4. Vérifie le dispositif avec les commandes de SETUP.md §4.
5. Ne committe rien : .claude/ et docs/SECURITY.md sont gitignorés (volontaire).
6. Rappelle-moi d'ouvrir /hooks (ou de redémarrer Claude Code) puis d'approuver les hooks du projet (SETUP.md §3).
Lis d'abord docs/MEMO-methode-CAP4.md pour le contexte de la méthode.
```

### 7.2 · Mettre à jour un PC en retard sur Git

```text
Mets ce dépôt CAP⁴ à jour (il est en retard sur Git) et rafraîchis les garde-fous.

/!\ Ce dossier est sous pCloud -> le .git peut être PÉRIMÉ. Procède ainsi :
1. git fetch origin  — NE te fie PAS au "up to date with origin/main" tant que ce fetch n'est pas fait.
2. Compare l'état réel local <-> origin/main :
   - si les fichiers SUIVIS == origin/main (aucune vraie modif locale) -> git reset --hard origin/main (fast-forward sûr) ;
   - s'il existe de vraies modifs locales non poussées -> montre-les-moi et DEMANDE avant d'écraser.
   Fichiers volontairement locaux, à NE PAS toucher/écraser : docs/SECURITY.md, docs/brief-commercial-CAP3.md, tout .claude/.
3. Rafraîchis les garde-fous : si .claude/hooks/*.sh ou .claude/settings.json diffèrent du verbatim de docs/SETUP.md (§2), recrée-les à l'identique. NE touche PAS à docs/SECURITY.md (mes constats).
4. Si les hooks ont changé, rappelle-moi d'ouvrir /hooks (ou de redémarrer) + approuver.
```
