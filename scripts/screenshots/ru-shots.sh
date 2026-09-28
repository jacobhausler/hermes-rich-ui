#!/bin/zsh
# Screenshot driver for hermes-rich-ui. Runs ON the Mac against the isolated dev
# instance (CDP :9333, launched by launch.sh). Every JS expression lives HERE so no
# quoting crosses ssh hops.
#
#   ru-shots.sh open <session_id>      open the gallery chat
#   ru-shots.sh cards                  list rendered cards: [{id, y, h, title}]
#   ru-shots.sh shot <name> <card_id>  scroll card into view, expand, clip-shot it -> $OUT/<name>.png
#   ru-shots.sh all <gallery.json>     shot every card in the gallery file
#   ru-shots.sh text                   first 2000 chars of body text (debug)
#   ru-shots.sh errors                 renderer console errors mentioning rich-ui
export PATH=$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH
cd ~/.hermes/cache/ru-shots
OUT=~/.hermes/cache/ru-shots/ru-out; mkdir -p $OUT
E() { node cdp.mjs eval "$1"; }

case "$1" in
  open)
    # $2 = exact session title (seed titles carry the session id); falls back to any "rich-ui gallery" row
    E '(() => { const want="'"${2:-}"'"; const els=[...document.querySelectorAll("button, a[href], [role=button]")].filter(e=>{const t=e.textContent.trim(); return want ? (t===want || t.startsWith(want+" ")) : t.startsWith("rich-ui gallery")}); if(!els.length) return "NO ROW"; els[els.length-1].click(); return "clicked "+els[els.length-1].tagName })()'
    sleep 3
    E 'location.pathname + " :: cards=" + document.querySelectorAll("[data-ru-card]").length + " loading=" + document.querySelectorAll("[data-ru-loading]").length'
    ;;
  cards)
    E '(() => [...document.querySelectorAll("[data-ru-card]")].map(c=>{const r=c.getBoundingClientRect(); return {id:c.getAttribute("data-ru-card"), y:Math.round(r.y), h:Math.round(r.height), w:Math.round(r.width), title:(c.querySelector("[data-ru=Card] header, [data-ru-summary]")||c).textContent.trim().slice(0,50)}}))()'
    ;;
  shot)
    NAME=$2; ID=$3
    node ru-cdp.mjs card $ID $OUT/$NAME.png
    ;;
  shot-old)
    NAME=$2; ID=$3
    # expand (Show more) if capped, scroll into view, clear hover, measure.
    E '(() => { const c=document.querySelector("[data-ru-card=\"'"$ID"'\"]"); if(!c) return "NO CARD"; const b=c.querySelector("[data-ru-toggle]"); if(b && b.textContent==="Show more") b.click(); return "ok" })' >/dev/null
    sleep 0.6
    E '(() => { const c=document.querySelector("[data-ru-card=\"'"$ID"'\"]"); c.scrollIntoView({block:"start"}); const sc=c.closest("[data-slot=thread-viewport], [class*=overflow]")||document.scrollingElement; sc.scrollTop-=12; return "scrolled" })' >/dev/null
    sleep 0.8
    node cdp.mjs move 2 2 >/dev/null
    R=$(E '(() => { const c=document.querySelector("[data-ru-card=\"'"$ID"'\"]"); const r=c.getBoundingClientRect(); const x=Math.max(0,Math.floor(r.x)-8), y=Math.max(0,Math.floor(r.y)-8); return [x,y,Math.ceil(r.width)+16,Math.min(innerHeight-y,Math.ceil(r.height)+16)].join(" ") })()' | tr -d '"')
    node cdp.mjs shot $OUT/$NAME.png ${=R}
    echo "$NAME clip=$R"
    ;;
  all)
    G=$2
    SID=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1])).session_id)' $G)
    node ru-cdp.mjs tall 1280 1900
    $0 open $SID
    node -e 'const g=JSON.parse(require("fs").readFileSync(process.argv[1])); for (const [n,id] of Object.entries(g.cards)) console.log(n+" "+id)' $G | while read n id; do
      $0 shot $n $id
    done
    node ru-cdp.mjs untall
    ls -la $OUT
    ;;
  text)
    E 'document.body.innerText.slice(0,2000).replace(/\n+/g," | ")'
    ;;
  errors)
    grep -a '\[renderer console' ~/.cache/ru-shots-home/logs/desktop.log 2>/dev/null | grep -i 'rich-ui\|richui' | tail -20
    ;;
  size)
    node cdp.mjs size ${2:-1280} ${3:-900}; sleep 1; E '[innerWidth, innerHeight]'
    ;;
  b64)
    base64 -i $OUT/$2.png
    ;;
  tar)
    tar czf - -C $OUT . | base64
    ;;
esac
