$(document).ready(function () {
  $(".header").click(function () {
    const group = $(this).data("group");

    // Special handling for Mason and Liberty
    if (group === "group-mason" || group === "group-liberty") {
      const isLibertyClick = group === "group-liberty";
      const childHeadersVisible = isLibertyClick
        ? $("[data-liberty='true']").not(".hidden").length > 0
        : $("[data-mason='true']").not(".hidden").length > 0;

      if (childHeadersVisible) {
        // Hide child headers and show all regular top-level headers
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
        // Show only child headers
        $(".header")
          .not(this)
          .not(isLibertyClick ? "[data-liberty='true']" : "[data-mason='true']")
          .addClass("hidden");
        if (isLibertyClick) {
          $("[data-liberty='true']").removeClass("hidden");
        } else {
          $("[data-mason='true']").removeClass("hidden");
        }
      }
      // Always hide all subheaders and items
      $(".sub-header, .item").addClass("hidden");
      return;
    }

    // Special handling for Mason's and Liberty's sub-headers
    if (
      $(this).attr("data-mason") === "true" ||
      $(this).attr("data-liberty") === "true"
    ) {
      const isFromMason = $(this).attr("data-mason") === "true";
      const isExpanded =
        $(this).siblings(`.sub-header[data-group='${group}']`).not(".hidden")
          .length > 0;

      $(".sub-header, .item").addClass("hidden");
      if (isExpanded) {
        // Show all child headers again
        if (isFromMason) {
          $("[data-mason='true']").removeClass("hidden");
          // Keep Mason visible
          $("[data-group='group-mason']").removeClass("hidden");
        } else {
          $("[data-liberty='true']").removeClass("hidden");
          // Keep Liberty visible
          $("[data-group='group-liberty']").removeClass("hidden");
        }
      } else {
        // Hide other child headers but keep this one
        if (isFromMason) {
          $("[data-mason='true']").addClass("hidden");
          $(this).removeClass("hidden");
          $(this)
            .siblings(`.sub-header[data-group='${group}']`)
            .removeClass("hidden");
          // Keep Mason visible
          $("[data-group='group-mason']").removeClass("hidden");
        } else {
          $("[data-liberty='true']").addClass("hidden");
          $(this).removeClass("hidden");
          $(this)
            .siblings(`.sub-header[data-group='${group}']`)
            .removeClass("hidden");
          // Keep Liberty visible
          $("[data-group='group-liberty']").removeClass("hidden");
        }
      }
      return;
    }

    // Modified behavior for other headers
    const isExpanded =
      $(this).siblings(`.sub-header[data-group='${group}']`).not(".hidden")
        .length > 0;

    $(".sub-header, .item").addClass("hidden");
    if (isExpanded) {
      // Show regular headers and handle special sections
      if ($("[data-mason='true']").not(".hidden").length > 0) {
        // If Mason section is active, keep Mason headers visible
        $("[data-mason='true']").removeClass("hidden");
        $("[data-group='group-mason']").removeClass("hidden");
      } else if ($("[data-liberty='true']").not(".hidden").length > 0) {
        // If Liberty section is active, keep Liberty headers visible
        $("[data-liberty='true']").removeClass("hidden");
        $("[data-group='group-liberty']").removeClass("hidden");
      } else {
        // Otherwise show only regular headers
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
  });

  $(".sub-header").click(function () {
    const group = $(this).data("group");
    const currentSubHeader = $(this);
    const isExpanded =
      $(this).nextUntil(".sub-header", ".item").not(".hidden").length > 0;

    if (!isExpanded) {
      // Hide all items and other subheaders
      $(".item, .sub-header").addClass("hidden");
      // Show current subheader
      $(this).removeClass("hidden");
      // Show items until next subheader
      $(this).nextUntil(".sub-header", ".item").removeClass("hidden");
    } else {
      // Show only sibling subheaders with same group
      $(`[data-group='${group}'].sub-header`).removeClass("hidden");
      // Hide all items
      $(".item").addClass("hidden");
    }
  });

  $(".item").click(function () {
    $(".item").removeClass("active");
    $(this).addClass("active");

    const file = $(this).data("file");
    const divId = $(this).data("id");

    $(".content").load(file + " #" + divId, function () {
      // Wrap text nodes with spans but preserve whitespace exactly
      $(".content")
        .find("*")
        .contents()
        .each(function () {
          if (this.nodeType === 3 && this.textContent.length > 0) {
            let cleaned = this.textContent.replace(/\n/g, "");

            // Remove leading whitespace only for the first top-level line
            if (
              $(this).parent().is(".content") ||
              $(this).is($(this).parent().contents().get(0))
            ) {
              cleaned = cleaned.replace(/^\s+/, "");
            }

            const parts = cleaned.split(/(\s+)/);
            const wrapped = parts
              .map((part) => {
                if (/^\s+$/.test(part)) return part;
                if ($(this).closest(".content-nav").length) {
                  return part; // don't wrap nav items in noteWord spans
                }
                return `<span class="noteWord">${part}</span>`;

              })
              .join("");
            $(this).replaceWith(wrapped);
          }
        });

      // Remove any empty noteWord spans
      $(".content")
        .find(".noteWord")
        .filter(function () {
          return $(this).text().trim() === "";
        })
        .remove();

      // ✅ Highlight words that already have notes
      $(".noteWord").each(function () {
        const word = $(this).text();
        const key = `${divId}::${word}`;
        if (localStorage.getItem(key)) {
          $(this).addClass("has-note");
        }
      });

      // ✅ Add click handler to show note
      $(".noteWord").on("click", function () {
        if ($(this).closest(".content-item").length) {
          return;
        }
        const activeWord = $(this).text();
        const key = `${divId}::${activeWord}`;
        const existingNote = localStorage.getItem(key) || "";

        $("#noteInput").val(existingNote);
        $("#noteOverlay").removeClass("hidden").data("note-key", key);
        $("#overlayBackdrop").addClass("visible");
      });
      $(".content").append('<button id="scrollTopBtn"></button>');
      $(".content").append('<div style="height: 30em;"></div>');
    });
  });
  $(document).on("click", ".content-item", function () {
    const targetId = $(this).data("content");
    const container = $(this).closest(".content-container");

    // Hide all text sections in this container
    container.find(".content-text").addClass("hidden");

    // Show the one that matches this item
    container.find("#" + targetId).removeClass("hidden");
  });

  $("#overlayBackdrop").click(function () {
    const key = $("#noteOverlay").data("note-key");
    const value = $("#noteInput").val().trim();

    if (value) {
      localStorage.setItem(key, value);
    } else {
      localStorage.removeItem(key);
    }

    // 🔽 Update highlight
    const [sectionId, word] = key.split("::");
    $(".noteWord").each(function () {
      if ($(this).text() === word) {
        if (value) {
          $(this).addClass("has-note");
        } else {
          $(this).removeClass("has-note");
        }
      }
    });

    $("#noteOverlay").addClass("hidden");
    $("#overlayBackdrop").removeClass("visible");
  });

  // ✅ Auto-grow textarea height
  $("#noteInput").on("input", function () {
    this.style.height = "auto";
    this.style.height = this.scrollHeight + "px";
  });

  $("#closeNoteBtn").click(function () {
    const key = $("#noteOverlay").data("note-key");
    const value = $("#noteInput").val().trim();

    if (value) {
      localStorage.setItem(key, value);

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
      localStorage.removeItem(key);
    }

    $("#noteOverlay").addClass("hidden");
    $("#overlayBackdrop").removeClass("visible");
  });

  $("#noteBox").click(function (event) {
    event.stopPropagation(); // Stop click from bubbling to #overlayBackdrop
  });

  // Function to update background with CSS rule
  function updateBackground(backgroundValue) {
    const styleSheet = document.styleSheets[0];
    const rules = styleSheet.cssRules || styleSheet.rules;
    for (let i = 0; i < rules.length; i++) {
      if (rules[i].selectorText === "body::before") {
        rules[i].style.background = backgroundValue;
        localStorage.setItem("background", backgroundValue);
        break;
      }
    }
  }

  // Keep all your localStorage loading
  const savedBackground = localStorage.getItem("background");
  const savedFont = localStorage.getItem("font");
  const savedFontSize = localStorage.getItem("fontSize");
  const savedWidth = localStorage.getItem("contentWidth");

  if (savedBackground) {
    updateBackground(savedBackground);
  }
  if (savedFont) {
    $("body").css("font-family", savedFont);
  }
  if (savedFontSize) {
    $(".content").css("font-size", savedFontSize);
  }
  if (savedWidth) {
    $(".content").css("max-width", savedWidth);
  }
  const savedTheme = localStorage.getItem("theme");

  if (savedTheme === "white") {
    $("body").addClass("white-theme");
  } else {
    $("body").removeClass("white-theme").addClass("gradient-theme");

    if (savedBackground) {
      updateBackground(savedBackground);
    }
  }

  // Add the new button handlers
  $(".control-toggle").click(function () {
    const type = $(this).data("type");
    const targetRow = $(`#${type}-row`);

    // If this row is already visible, hide it
    if (targetRow.css("display") === "flex") {
      targetRow.hide();
      return;
    }

    // Hide all other rows
    $(".option-row").hide();

    // Show this row with flex display
    targetRow.css("display", "flex");
  });

  // Color buttons

  $("#colors-row button")
    .not("#whiteThemeBtn")
    .click(function () {
      const gradient = $(this).data("gradient");
      $("html, body").removeClass("white-theme").addClass("gradient-theme");
      updateBackground(gradient);
      localStorage.setItem("background", gradient);
      localStorage.setItem("theme", "gradient");
    });

  $("#whiteThemeBtn").click(function () {
    $("html, body").removeClass("gradient-theme").addClass("white-theme");
    localStorage.setItem("theme", "white");
  });

  // Font buttons
  $("#fonts-row button").click(function () {
    const fontFamily = $(this).data("font");
    $("body").css("font-family", fontFamily);
    localStorage.setItem("font", fontFamily);
  });

  // Size buttons
  $("#sizes-row button").click(function () {
    const fontSize = $(this).data("size");
    $(".content").css("font-size", fontSize);
    localStorage.setItem("fontSize", fontSize);
  });

  // Width buttons
  $("#width-row button").click(function () {
    const width = $(this).data("width");
    $(".content").css("max-width", width);
    localStorage.setItem("contentWidth", width);
  });

  // Keep your layout toggle variables and code
  const layoutToggle = $("#layout-toggle");
  const container = $(".container");

  // Keep your layout toggle saved preference code
  const savedLayout = localStorage.getItem("layout");
  if (savedLayout === "vertical") {
    container.addClass("vertical-layout");
    layoutToggle.html("↔");
  }

  layoutToggle.click(function () {
    container.toggleClass("vertical-layout");
    // Reset all hidden states when toggling layout
    $(".sub-header, .item").addClass("hidden");
    $(".header").removeClass("hidden");

    if (container.hasClass("vertical-layout")) {
      localStorage.setItem("layout", "vertical");
      $(this).html("↔");
    } else {
      localStorage.setItem("layout", "horizontal");
      $(this).html("↕");
    }
  });

  // In your main JS file (e.g. index2.html or linked script)
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

  $("#toggle-classification-bar").click(function () {
    $("#classification-bar").toggle();
  });

  $(document).on("click", "#scrollTopBtn", function () {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});
