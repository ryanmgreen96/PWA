
// 2222222222222222222222222222222



/********************************************
 * script.js — FULL FILE with Firestore sync
 * (Numbered code edits in comments)
 ********************************************/

/* =========================================
   [1] Firebase SDK imports + init (top-level)
   ========================================= */
// Firebase v9+ CDN imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  enableIndexedDbPersistence,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyD90ou_VU3c2QWu8O9tEKO41ccWwrTdlw0",
  authDomain: "collection-b09db.firebaseapp.com",
  projectId: "collection-b09db",
  storageBucket: "collection-b09db.firebasestorage.app",
  messagingSenderId: "952428700049",
  appId: "1:952428700049:web:95e2a1504cf42700d9fa30",
};

// Initialize Firebase app
const fbApp = initializeApp(firebaseConfig);

// Initialize Firestore and enable offline persistence
const db = getFirestore(fbApp);
enableIndexedDbPersistence(db).catch((err) => {
  // Ignore persistence errors (multi-tab, etc.)
  console.warn("IndexedDB persistence could not be enabled:", err.message);
});


/* ===========================================================
   [2] Sync constants, device ID, and meta helpers (top-level)
   =========================================================== */
const FIRESTORE_COLLECTION = "appState";
const FIRESTORE_DOC_ID = "shared";
const FS_DOC_REF = () => doc(db, FIRESTORE_COLLECTION, FIRESTORE_DOC_ID);

function getDeviceId() {
  let id = localStorage.getItem("deviceId");
  if (!id) {
    id = "dev_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("deviceId", id);
  }
  return id;
}
const DEVICE_ID = getDeviceId();

function getLocalMeta() {
  try {
    return JSON.parse(localStorage.getItem("appMeta")) || {};
  } catch {
    return {};
  }
}
function setLocalMeta(meta) {
  localStorage.setItem("appMeta", JSON.stringify(meta || {}));
}

/* ===================================================================
   [3] Merge strategy (most-recently-closed snapshot wins on conflicts)
   =================================================================== */
function deepMergeAppData(preferred, fallback) {
  // Start with a shallow copy of the preferred snapshot
  const result = { ...preferred };

  // Merge simple top-level keys if missing in preferred
  const topKeys = [
    "notes",
    "background",
    "font",
    "fontSize",
    "contentWidth",
    "theme",
    "layout",
  ];
  topKeys.forEach((k) => {
    if (result[k] == null && fallback[k] != null) result[k] = fallback[k];
  });

  // Merge notes object: key-by-key choose preferred when both present
  const prefNotes = preferred.notes || {};
  const fallNotes = fallback.notes || {};
  const mergedNotes = { ...fallNotes, ...prefNotes };
  result.notes = mergedNotes;

  return result;
}

/* ===========================================================
   [4] Firestore save/load helpers + debounced save (top-level)
   =========================================================== */
let saveTimer = null;
function saveToFirestoreDebounced(payload, delay = 500) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await setDoc(
        FS_DOC_REF(),
        {
          data: payload.appData,
          lastSavedAt: Date.now(),
          // lastClosedAt is only set during "close" events
          lastDeviceId: DEVICE_ID,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch {
      // Offline or other issue; Firestore will retry when possible.
    }
  }, delay);
}

async function saveCloseSnapshotToFirestore(appData, lastClosedAtMillis) {
  try {
    await setDoc(
      FS_DOC_REF(),
      {
        data: appData,
        lastClosedAt: lastClosedAtMillis,
        lastDeviceId: DEVICE_ID,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch {
    // Offline; will sync later if persistence is available.
  }
}

async function fetchFirestoreSnapshot() {
  try {
    const snap = await getDoc(FS_DOC_REF());
    if (snap.exists()) {
      const d = snap.data();
      return {
        appData: d.data,
        lastClosedAt: d.lastClosedAt || 0,
        lastSavedAt: d.lastSavedAt || 0,
        lastDeviceId: d.lastDeviceId || null,
      };
    }
  } catch {
    // ignore; likely offline
  }
  return null;
}

/* =========================================
   [5] Live listener (optional) for remote wins
   ========================================= */
function startFirestoreListener(getAppData, setAppDataAndApply) {
  // If another device closes more recently, adopt its snapshot.
  onSnapshot(FS_DOC_REF(), (snap) => {
    if (!snap.exists()) return;
    const d = snap.data() || {};
    const remote = {
      appData: d.data || null,
      lastClosedAt: d.lastClosedAt || 0,
      lastSavedAt: d.lastSavedAt || 0,
    };
    if (!remote.appData) return;

    const meta = getLocalMeta();
    const localLastClosed = meta.lastClosedAt || 0;

    if (remote.lastClosedAt && remote.lastClosedAt > localLastClosed) {
      // Remote was closed more recently -> adopt
      const merged = deepMergeAppData(remote.appData, getAppData());
      setAppDataAndApply(merged, {
        lastClosedAt: remote.lastClosedAt,
        lastSavedAt: Date.now(),
      });
    }
  });
}

/* =========================
   [6] Main app (original)
   ========================= */













   $(document).ready(function () {
     // ================================
     // APP DATA (single object) + helpers
     // ================================
     const defaultAppData = () => ({
       // notes store both item-level notes and per-word notes:
       //   - `${divId}::note` => string
       //   - `${divId}::${word}` => string
       notes: {},
       // UI prefs
       background: null,
       font: null,
       fontSize: null,
       contentWidth: null,
       theme: "gradient", // "gradient" | "white"
       layout: "horizontal", // "horizontal" | "vertical"
     });

     let appData;

     /* ---------------------------------------------------------
     [7] loadAppData/saveAppData EXTENDED for Firestore writes
     --------------------------------------------------------- */
     function loadAppData() {
       try {
         appData =
           JSON.parse(localStorage.getItem("appData")) || defaultAppData();
       } catch (e) {
         appData = defaultAppData();
       }
       return appData;
     }
     function saveAppData() {
       localStorage.setItem("appData", JSON.stringify(appData));

       // [7a] Firestore write (debounced)
       saveToFirestoreDebounced({ appData });
     }

     // Optional one-time migration of any legacy keys (background/font/etc + :: note keys)
     function migrateLegacyStorageIntoAppData() {
       const existing = localStorage.getItem("appData");
       if (existing) return; // already migrated/created

       const keys = [];
       for (let i = 0; i < localStorage.length; i++) {
         const k = localStorage.key(i);
         if (k !== "appData") keys.push(k);
       }

       appData = defaultAppData();

       keys.forEach((k) => {
         const v = localStorage.getItem(k);
         if (k.includes("::")) {
           // note keys
           if (v) appData.notes[k] = v;
         } else if (k === "background") {
           appData.background = v;
         } else if (k === "font") {
           appData.font = v;
         } else if (k === "fontSize") {
           appData.fontSize = v;
         } else if (k === "contentWidth") {
           appData.contentWidth = v;
         } else if (k === "theme") {
           appData.theme = v || appData.theme;
         } else if (k === "layout") {
           appData.layout = v || appData.layout;
         }
       });

       saveAppData();
     }

     loadAppData();
     migrateLegacyStorageIntoAppData(); // harmless if nothing to migrate
     loadAppData(); // reload after potential migration

     /* =======================================================
     [8] Apply UI extracted so we can re-run after FS merges
     ======================================================= */
     function applyUIFromAppData() {
       if (appData.background) updateBackground(appData.background);
       if (appData.font) $("body").css("font-family", appData.font);
       if (appData.fontSize) $(".content").css("font-size", appData.fontSize);
       if (appData.contentWidth)
         $(".content").css("max-width", appData.contentWidth);

       if (appData.theme === "white") {
         $("body").addClass("white-theme").removeClass("gradient-theme");
       } else {
         $("body").removeClass("white-theme").addClass("gradient-theme");
         if (appData.background) updateBackground(appData.background);
       }

       const layoutToggle = $("#layout-toggle");
       const container = $(".container");
       if (appData.layout === "vertical") {
         container.addClass("vertical-layout");
         layoutToggle.html("↔");
       } else {
         container.removeClass("vertical-layout");
         layoutToggle.html("↕");
       }
     }

     /* =================================================================
     [9] On-load Firestore sync (most-recently-closed snapshot wins)
     ================================================================= */
     (async function initialFirestoreSync() {
       const localMeta = getLocalMeta(); // { lastClosedAt?, lastSavedAt? }
       const fsSnap = await fetchFirestoreSnapshot();

       if (fsSnap && fsSnap.appData) {
         // Choose winner by lastClosedAt
         const fsClosed = fsSnap.lastClosedAt || 0;
         const localClosed = localMeta.lastClosedAt || 0;

         if (fsClosed >= localClosed) {
           // Firestore is newer or equal -> adopt Firestore then merge missing keys from local
           const merged = deepMergeAppData(fsSnap.appData, appData);
           appData = merged;
           saveAppData(); // triggers debounced FS save (merge: ok)
           applyUIFromAppData();
           setLocalMeta({
             ...localMeta,
             lastSavedAt: Date.now(),
             lastClosedAt: fsClosed, // align with remote
           });
         } else {
           // Local was closed more recently -> push local up as the shared version
           saveToFirestoreDebounced({ appData }, 0);
         }
       } else {
         // No remote doc -> push local up
         saveToFirestoreDebounced({ appData }, 0);
       }

       // Start live listener to accept newer "closed" snapshots
       startFirestoreListener(
         () => appData,
         (next, newMeta) => {
           appData = next;
           saveAppData();
           applyUIFromAppData();
           setLocalMeta({ ...(getLocalMeta() || {}), ...(newMeta || {}) });
         }
       );
     })();

     /* ====================================================
     [10] Close/visibility handlers to stamp lastClosedAt
     ==================================================== */
     function stampAndSyncOnClose() {
       const now = Date.now();
       const meta = getLocalMeta();
       const nextMeta = { ...meta, lastClosedAt: now, lastSavedAt: now };
       setLocalMeta(nextMeta);
       saveCloseSnapshotToFirestore(appData, now);
     }
     window.addEventListener("beforeunload", stampAndSyncOnClose);
     document.addEventListener("visibilitychange", () => {
       if (document.visibilityState === "hidden") {
         stampAndSyncOnClose();
       }
     });

     // ================================
     // Header click logic (unchanged behavior)
     // ================================
    $(".header").click(function () {
      const group = $(this).data("group");

      // Special handling for Mason and Liberty (keep prior behavior)
      if (group === "group-mason" || group === "group-liberty") {
        const isLibertyClick = group === "group-liberty";
        const childHeadersVisible = isLibertyClick
          ? $("[data-liberty='true']").not(".hidden").length > 0
          : $("[data-mason='true']").not(".hidden").length > 0;

        if (childHeadersVisible) {
          if (isLibertyClick) {
            $("[data-liberty='true']").addClass("hidden");
          } else {
            $("[data-mason='true']").addClass("hidden");
          }
          $(".header")
            .not("[data-mason='true']")
            .not("[data-liberty='true']")
            .removeClass("hidden");
        } else {
          $(".header")
            .not(this)
            .not(
              isLibertyClick ? "[data-liberty='true']" : "[data-mason='true']"
            )
            .addClass("hidden");
          if (isLibertyClick) $("[data-liberty='true']").removeClass("hidden");
          else $("[data-mason='true']").removeClass("hidden");
        }

        // Always hide all subheaders, items, and subheader note boxes
        $(
          ".sub-header, .item, #subheaderNoteBox, .subheaderToggleBtn"
        ).addClass("hidden");
        $(".content").empty();
        return;
      }

      // Modified behavior for other headers
      const isExpanded =
        $(this).siblings(`.sub-header[data-group='${group}']`).not(".hidden")
          .length > 0;

      $(".sub-header, .item, #subheaderNoteBox, .subheaderToggleBtn").addClass(
        "hidden"
      );
      $(".content").empty(); // clear content

      if (isExpanded) {
        // Show regular headers and handle special sections
        if ($("[data-mason='true']").not(".hidden").length > 0) {
          $("[data-mason='true']").removeClass("hidden");
          $("[data-group='group-mason']").removeClass("hidden");
        } else if ($("[data-liberty='true']").not(".hidden").length > 0) {
          $("[data-liberty='true']").removeClass("hidden");
          $("[data-group='group-liberty']").removeClass("hidden");
        } else {
          $(".header")
            .not("[data-mason='true']")
            .not("[data-liberty='true']")
            .removeClass("hidden");
        }
      } else {
        $(".header").not(this).addClass("hidden");
        $(this)
          .siblings(`.sub-header[data-group='${group}']`)
          .removeClass("hidden");
      }

      // Ensure all items are hidden
      $(".item").addClass("hidden");
    });


     // ================================
     // SUBHEADER CLICK FUNCTION
     // ================================
    $(".sub-header").click(function () {
      const group = $(this).data("group");
      const isExpanded =
        $(this).nextUntil(".sub-header", ".item").not(".hidden").length > 0;

      // Always hide other subheader note boxes and toggle buttons
      $("#subheaderNoteBox, .subheaderToggleBtn").remove();

      if (!isExpanded) {
        // Hide all items and other subheaders
        $(".item, .sub-header").addClass("hidden");
        $(this).removeClass("hidden");

        // Show items under this subheader
        const items = $(this)
          .nextUntil(".sub-header", ".item")
          .removeClass("hidden");

        // Hide all other note boxes
        $(".content").empty();

        // -----------------------------
        // Add subheader note box
        // -----------------------------
        const subheaderId = $(this).data("id") || $(this).text().trim();
        const noteKey = `${subheaderId}::note`;
        const savedNote = appData.notes[noteKey] || "";

        const noteBox = $(`
      <textarea id="subheaderNoteBox" placeholder="Type your subheader note..."
        style="
          display:block;
          width: calc(100% - 40px);
          margin: 0.5em auto;
          font-size: 0.9em;
          color: #ffffe0;
          background: transparent;
          border: 1px solid rgba(255,255,224,0.3);
          padding: 4px;
          resize: vertical;
        "
      >${savedNote}</textarea>
    `);

        // Default collapsed state
        noteBox.css({ height: "2em", overflow: "hidden" });

        // Create expand/collapse toggle button
        const toggleBtn = $(
          '<button class="subheaderToggleBtn">+</button>'
        ).css({
          display: "block",
          margin: "0.3em auto",
          padding: "0",
          width: "1.5em",
          height: "1.5em",
          "line-height": "1.5em",
          "text-align": "center",
          "font-size": "1em",
          "border-radius": "50%",
          border: "1px solid rgba(255,255,224,0.5)",
          background: "transparent",
          color: "#ffffe0",
          cursor: "pointer",
        });

        // Toggle expand/collapse
        toggleBtn.on("click", function (e) {
          e.stopPropagation();
          if (noteBox.hasClass("expanded")) {
            noteBox
              .removeClass("expanded")
              .css({ height: "2em", overflow: "hidden" });
          } else {
            noteBox
              .addClass("expanded")
              .css({
                height: noteBox[0].scrollHeight + "px",
                overflow: "visible",
              });
          }
        });

        // Insert button above noteBox
        if (items.length > 0) items.last().after(noteBox);
        else $(this).after(noteBox);
        noteBox.before(toggleBtn);

        // Auto-grow and save note
        noteBox.on("input", function () {
          if (noteBox.hasClass("expanded")) {
            this.style.height = "auto";
            this.style.height = this.scrollHeight + "px";
          }
          const val = $(this).val().trim();
          if (val) appData.notes[noteKey] = val;
          else delete appData.notes[noteKey];
          saveAppData();
        });

        // Ensure other items remain hidden
        $(".item").not(items).addClass("hidden");
      } else {
        // Collapse: show only sibling subheaders of this group
        $(`[data-group='${group}'].sub-header`).removeClass("hidden");
        $(".item").addClass("hidden");
        $("#subheaderNoteBox, .subheaderToggleBtn").remove();
        $(".content").empty();
      }
    });

     // ================================
     // ITEM CLICK FUNCTION
     // ================================
     $(".item").click(function () {
       // Mark active
       $(".item").removeClass("active");
       $(this).addClass("active");

       const file = $(this).data("file");
       const divId = $(this).data("id");

       // Load item content
       $(".content").load(file + " #" + divId, function () {
         // Remove previous note box and floating button
         $("#itemNoteBox, #itemFloatBtn").remove();

         // Create item note box
         const noteKey = `${divId}::note`;
         const savedNote = appData.notes[noteKey] || "";
         const noteBox = $(`
      <textarea id="itemNoteBox"
        placeholder="Type your note..."
        style="
          display: block;
          width: calc(100% - 40px);
          margin-bottom: 1em;
          font-size: 0.9em;
          color: #ffffe0;
          background: transparent;
          border: 1px solid rgba(255,255,224,0.3);
          padding: 4px;
          resize: vertical;
        ">${savedNote}</textarea>
    `);
         $(".content").prepend(noteBox);

         // Auto-grow + save note
         noteBox
           .on("input", function () {
             this.style.height = "auto";
             this.style.height = this.scrollHeight + "px";
             const val = $(this).val().trim();
             if (val) appData.notes[noteKey] = val;
             else delete appData.notes[noteKey];
             saveAppData();
           })
           .trigger("input");

         // Wrap text nodes in spans (skip note box)
         $(".content")
           .find("*")
           .not("#itemNoteBox")
           .contents()
           .each(function () {
             if (this.nodeType === 3 && this.textContent.trim().length > 0) {
               let cleaned = this.textContent.replace(/\n/g, "");
               const parts = cleaned.split(/(\s+)/);
               const wrapped = parts
                 .map((part) => {
                   if (/^\s+$/.test(part)) return part;
                   return `<span class="noteWord">${part}</span>`;
                 })
                 .join("");
               $(this).replaceWith(wrapped);
             }
           });

         // Remove empty noteWord spans
         $(".content")
           .find(".noteWord")
           .filter(function () {
             return $(this).text().trim() === "";
           })
           .remove();

         // Highlight words with saved notes
         $(".noteWord").each(function () {
           const key = `${divId}::${$(this).text()}`;
           if (appData.notes[key]) $(this).addClass("has-note");
         });

         // Add click handler for words
         $(".noteWord")
           .off("click")
           .on("click", function () {
             const key = `${divId}::${$(this).text()}`;
             $("#noteInput").val(appData.notes[key] || "");
             $("#noteOverlay").removeClass("hidden").data("note-key", key);
             $("#overlayBackdrop").addClass("visible");
           });

         // Floating button for modal access
         // Floating button for modal access
         $("#itemFloatBtn").remove();
         const floatBtn = $('<button id="itemFloatBtn">✎</button>')
           .css({
             position: "fixed",
             bottom: "1em",
             right: "1em",
             width: "2em",
             height: "2em",
             "border-radius": "50%",
             border: "1px solid rgba(255,255,224,0.5)",
             background: "transparent",
             color: "#ffffe0",
             cursor: "pointer",
             "z-index": 9999,
           })
           .appendTo("body");

         // Function to update button size based on window width
         function updateFloatBtnSize() {
           if ($(window).width() < 700) {
             floatBtn.css({
               width: "1em",
               height: "1em",
               "font-size": "0.7em",
               "line-height": "1em",
             });
           } else {
             floatBtn.css({
               width: "2em",
               height: "2em",
               "font-size": "1em",
               "line-height": "2em",
             });
           }
         }

         // Initial call
         updateFloatBtnSize();

         // Update on window resize
         $(window).on("resize", updateFloatBtnSize);

         floatBtn.on("click", function () {
           const currentText = appData.notes[noteKey] || "";
           $("#noteInput").val(currentText);
           $("#noteOverlay").removeClass("hidden").data("note-key", noteKey);
           $("#overlayBackdrop").addClass("visible");
         });

         // Sync modal back to note box
         $("#noteInput")
           .off("input")
           .on("input", function () {
             const key = $("#noteOverlay").data("note-key");
             const val = $(this).val();
             appData.notes[key] = val;
             saveAppData();

             // Update noteBox if currently loaded
             if ($("#itemNoteBox").length && key === noteKey) {
               $("#itemNoteBox").val(val).trigger("input");
             }
           });

         // Optional: scrollTop & spacing
         $(".content").append('<button id="scrollTopBtn"></button>');
         $(".content").append('<div style="height: 30em;"></div>');
       });
     });


     // ================================
     // Content-item switcher (unchanged)
     // ================================
     $(document).on("click", ".content-item", function () {
       const targetId = $(this).data("content");
       const container = $(this).closest(".content-container");
       container.find(".content-text").addClass("hidden");
       container.find("#" + targetId).removeClass("hidden");
     });

     // ================================
     // Overlay save/close -> appData.notes
     // ================================
     $("#overlayBackdrop").click(function () {
       const key = $("#noteOverlay").data("note-key");
       const value = $("#noteInput").val().trim();

       if (value) {
         appData.notes[key] = value;
       } else {
         delete appData.notes[key];
       }
       saveAppData();

       // Update highlight
       const [sectionId, word] = key.split("::");
       $(".noteWord").each(function () {
         if ($(this).text() === word) {
           if (value) $(this).addClass("has-note");
           else $(this).removeClass("has-note");
         }
       });

       $("#noteOverlay").addClass("hidden");
       $("#overlayBackdrop").removeClass("visible");
     });

     // Auto-grow textarea height
     $("#noteInput").on("input", function () {
       this.style.height = "auto";
       this.style.height = this.scrollHeight + "px";
     });

     $("#closeNoteBtn").click(function () {
       const key = $("#noteOverlay").data("note-key");
       const value = $("#noteInput").val().trim();

       if (value) {
         appData.notes[key] = value;

         // Highlight the word after saving
         const [sectionId, word] = key.split("::");
         $(".content")
           .find(".noteWord")
           .each(function () {
             if ($(this).text() === word) {
               $(this).addClass("has-note");
             }
           });
       } else {
         delete appData.notes[key];
       }

       saveAppData();
       $("#noteOverlay").addClass("hidden");
       $("#overlayBackdrop").removeClass("visible");
     });

     $("#noteBox").click(function (event) {
       event.stopPropagation(); // Stop click from bubbling to #overlayBackdrop
     });

     // ================================
     // Background/theme/font/size/width using appData
     // ================================
     function updateBackground(backgroundValue) {
       const styleSheet = document.styleSheets[0];
       const rules = styleSheet && (styleSheet.cssRules || styleSheet.rules);
       if (!rules) return;

       for (let i = 0; i < rules.length; i++) {
         if (rules[i].selectorText === "body::before") {
           rules[i].style.background = backgroundValue;
           appData.background = backgroundValue;
           saveAppData();
           break;
         }
       }
     }

     // Apply saved UI
     applyUIFromAppData();

     // Toggle rows (unchanged)
     $(".control-toggle").click(function () {
       const type = $(this).data("type");
       const targetRow = $(`#${type}-row`);

       if (targetRow.css("display") === "flex") {
         targetRow.hide();
         return;
       }
       $(".option-row").hide();
       targetRow.css("display", "flex");
     });

     // Color buttons -> gradient theme
     $("#colors-row button")
       .not("#whiteThemeBtn")
       .click(function () {
         const gradient = $(this).data("gradient");
         $("html, body").removeClass("white-theme").addClass("gradient-theme");
         updateBackground(gradient);
         appData.theme = "gradient";
         saveAppData();
       });

     // White theme
     $("#whiteThemeBtn").click(function () {
       $("html, body").removeClass("gradient-theme").addClass("white-theme");
       appData.theme = "white";
       saveAppData();
     });

     // Font buttons
     $("#fonts-row button").click(function () {
       const fontFamily = $(this).data("font");
       $("body").css("font-family", fontFamily);
       appData.font = fontFamily;
       saveAppData();
     });

     // Size buttons
     $("#sizes-row button").click(function () {
       const fontSize = $(this).data("size");
       $(".content").css("font-size", fontSize);
       appData.fontSize = fontSize;
       saveAppData();
     });

     // Width buttons
     $("#width-row button").click(function () {
       const width = $(this).data("width");
       $(".content").css("max-width", width);
       appData.contentWidth = width;
       saveAppData();
     });

     // ================================
     // Layout toggle using appData.layout
     // ================================
     const layoutToggle = $("#layout-toggle");
     const container = $(".container");

     if (appData.layout === "vertical") {
       container.addClass("vertical-layout");
       layoutToggle.html("↔");
     }

     layoutToggle.click(function () {
       container.toggleClass("vertical-layout");
       // Reset all hidden states when toggling layout
       $(".sub-header, .item").addClass("hidden");
       $(".header").removeClass("hidden");

       if (container.hasClass("vertical-layout")) {
         appData.layout = "vertical";
         $(this).html("↔");
       } else {
         appData.layout = "horizontal";
         $(this).html("↕");
       }
       saveAppData();
       applyUIFromAppData();
     });

     // ================================
     // Service worker (kept as in your script)
     // ================================
     if ("serviceWorker" in navigator) {
       if (
         window.location.hostname !== "127.0.0.1" &&
         window.location.hostname !== "localhost"
       ) {
         navigator.serviceWorker.register("/service-worker.js");
       } else {
         navigator.serviceWorker.getRegistrations().then((registrations) => {
           for (let registration of registrations) {
             registration.unregister();
           }
         });
       }
     }

     // Misc handlers (kept)
     $("#toggle-classification-bar").click(function () {
       $("#classification-bar").toggle();
     });

     $(document).on("click", "#scrollTopBtn", function () {
       window.scrollTo({ top: 0, behavior: "smooth" });
     });
   });
