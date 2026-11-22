// Extra element voor custom-rows-card (statisch beeld, type "image").
// Vereist custom-rows-card.js; de volgorde van laden maakt niet uit.
// Vereist de regels voor .extra-image-img in custom-cards-shared.css (volle breedte van de rij).
(() => {
  // Zo vaak (ms) wordt de ondertekende URL van een media-bestand vernieuwd; na een mislukte poging
  // wordt het na RETRY_AFTER opnieuw geprobeerd
  const RENEW_AFTER = 60 * 60 * 1000;
  const RETRY_AFTER = 60 * 1000;

  // Bestanden in de media-map van Home Assistant zijn beveiligd en hebben een ondertekende URL nodig.
  // Deze functie zet de opgegeven waarde om naar een media-source-adres; null betekent een gewone URL.
  //   media-source://media_source/local/Latest/placeholder.jpg  (zoals het is)
  //   /media/local/Latest/placeholder.jpg                       (de URL in de media-browser)
  //   media/Latest/placeholder.jpg                              (kort: de map "media" op schijf)
  const toMediaSource = (value) => {
    if (value.startsWith("media-source://")) return value;

    const url = value.match(/^\/media\/([^/]+)\/(.+)$/);
    if (url) return `media-source://media_source/${url[1]}/${url[2]}`;

    const folder = value.match(/^media\/(.+)$/);
    if (folder) return `media-source://media_source/local/${folder[1]}`;

    return null;
  };

  // Rij met alleen een beeld over de volle breedte; zolang het beeld niet geladen is blijft de rij verborgen
  const buildImage = (card, extra) => {
    const el = document.createElement("div");
    el.className = "extra extra-image";
    el.hidden = true;

    const img = document.createElement("img");
    img.className = "extra-image-img";
    img.alt = extra.name || "";
    img.draggable = false;

    if (extra.name) el.title = extra.name;

    el.append(img);

    const source = toMediaSource(extra.image);
    const control = { shown: null, pending: null, nextAt: 0, resolving: false, disposed: false };

    // Laadt de URL eerst op de achtergrond, zodat het beeld bij het vernieuwen niet knippert
    const show = (url) => {
      if (url === control.shown || url === control.pending) return;

      control.pending = url;

      const probe = new Image();

      probe.onload = () => {
        if (control.disposed) return;

        control.shown = url;
        img.src = url;
        el.hidden = false;
      };

      probe.onerror = () => {
        if (!control.disposed) console.error(`${card.localName}: afbeelding kan niet worden geladen: ${extra.image}`);
      };

      probe.src = url;
    };

    const resolve = async () => {
      if (control.resolving || !card._hass) return;

      control.resolving = true;

      try {
        const result = await card._hass.callWS({
          type: "media_source/resolve_media",
          media_content_id: source
        });

        control.nextAt = Date.now() + RENEW_AFTER;
        if (!control.disposed) show(card._resolveUrl(result.url));
      } catch (err) {
        control.nextAt = Date.now() + RETRY_AFTER;
        console.error(`${card.localName}: ${source} kan niet worden opgehaald:`, err);
      } finally {
        control.resolving = false;
      }
    };

    const update = () => {
      if (!source) show(card._resolveUrl(extra.image));
      else if (Date.now() >= control.nextAt) resolve();
    };

    return { el, update, dispose: () => { control.disposed = true; } };
  };

  (window.CustomRowsExtras ??= new Map()).set("image", {
    parse(extra, { params }) {
      if (typeof extra.image !== "string" || !extra.image.trim()) throw { key: "error.rows_extra_image", params };

      return {
        image: extra.image.trim(),
        name: extra.name // optioneel: alt-tekst en tooltip van het beeld
      };
    },
    build: buildImage
  });
  window.dispatchEvent(new Event("custom-rows-extras-changed"));
})();
