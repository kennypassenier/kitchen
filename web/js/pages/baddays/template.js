// The page markup, whole; a function so the words are read when the page is mounted.

import { t, lang } from "../../i18n/index.js";

export const sections = () => `
  <header class="bd-intro">
    <h1>${t("bad.title")}</h1>
    <p>
      ${t("bad.intro")}
    </p>
  </header>

  <section class="bd-sec" id="safe-dishes" aria-labelledby="h-safe-dishes">
    <div class="bd-sec__head">
      <h2 id="h-safe-dishes">${t("bad.secSafe")}</h2>
      <p>
        ${t("bad.secSafeText")}
      </p>
    </div>
    <section class="kp-card bd-card" id="bd-safe-card" data-kp-state="loading" aria-labelledby="bd-safe-t"
      data-kp-loading-words="${t("bad.loadingSafe")}">
      <div class="kp-card__header">
        <h3 class="kp-card__title" id="bd-safe-t">${t("bad.safeTitle")}</h3>
        <div class="kp-card__actions"><span class="kp-timestamp" data-bd-safe-count></span><button type="button" class="kp-button kp-button--primary" data-bd-safe-add>${t("bad.addSafe")}</button></div>
      </div>
      <p class="kp-card__body">${t("bad.safeBody")}</p>
      <div class="kp-card__stage">
        <div class="kp-card__data">
          <ul class="kp-actions bd-safe" data-kp-action-size="large" aria-label="${t("bad.safeLabel")}" data-bd-safe></ul>
        </div>
      </div>
    </section>
  </section>

  <section class="bd-sec" id="freezer" aria-labelledby="h-freezer">
    <div class="bd-sec__head">
      <h2 id="h-freezer">${t("bad.secFreezer")}</h2>
      <p>
        ${t("bad.secFreezerText")}
      </p>
    </div>
    <div class="bd-freezer" data-bd-freezer>
      <div class="kp-datatable" id="bd-freezer" data-kp-datatable data-kp-cards data-kp-page-sizes="none"
        data-kp-key="freezer" data-kp-state="loading" data-kp-busy-overlay>
        <div class="kp-datatable__bar">
          <input class="kp-datatable__search" data-kp-datatable-search type="search" aria-label="${t("bad.findLabel")}"
            placeholder="${t("bad.findPh")}" />
          <p class="kp-datatable__status" data-kp-datatable-status role="status" aria-live="polite"></p>
        </div>
        <div class="kp-table-wrap">
          <table class="kp-table">
            <caption class="kp-sr-only">${t("bad.caption")}</caption>
            <thead>
              <tr>
                <th scope="col" data-kp-sort="text">${t("bad.colDish")}</th>
                <th scope="col" data-kp-sort="number">${t("bad.colPortions")}</th>
                <th scope="col" data-kp-sort="number">${t("bad.colFrozen")}</th>
                <th scope="col">${t("bad.colHow")}</th>
                <th scope="col">${t("bad.colHint")}</th>
                <th scope="col"><span class="kp-sr-only">${t("bad.colAction")}</span></th>
              </tr>
            </thead>
            <tbody data-bd-rows></tbody>
          </table>
        </div>
        <div class="kp-empty" data-kp-art="none" data-kp-art-size="lg" data-kp-datatable-empty hidden>
          <p class="kp-empty__title" data-kp-datatable-empty-none>${t("bad.freezerEmptyTitle")}</p>
          <p class="kp-empty__body" data-kp-datatable-empty-none>
            ${t("bad.freezerEmptyText")}
          </p>
          <button type="button" class="kp-button kp-button--primary" data-kp-datatable-empty-none data-bd-add>
            ${t("bad.addToday")}
          </button>
          <p class="kp-empty__title" data-kp-datatable-empty-nomatch>${t("bad.noMatchTitle")}</p>
          <p class="kp-empty__body" data-kp-datatable-empty-nomatch>${t("bad.noMatchText")}</p>
          <button type="button" class="kp-button" data-kp-datatable-empty-nomatch data-kp-datatable-clear>${t("bad.clearSearch")}</button>
        </div>
        <div class="kp-alert kp-alert--destructive" data-kp-datatable-failed role="alert" hidden>
          <p data-kp-datatable-failed-reason>${t("bad.freezerFailed")}</p>
          <button type="button" class="kp-button" data-kp-datatable-retry>${t("common.tryAgain")}</button>
        </div>
      </div>
    </div>
    <div class="bd-add">
      <div class="bd-sec__head">
        <h3 id="h-freezer-add">${t("bad.addTitle")}</h3>
        <p>${t("bad.addText")}</p>
      </div>
      <form class="bd-add__form" data-kp-form data-bd-add-form novalidate aria-labelledby="h-freezer-add">
        <div class="kp-form__summary" data-kp-form-summary tabindex="-1" hidden></div>
        <div class="kp-formgrid" data-kp-formgrid-lines="lines">
        <div class="kp-formgrid__row" data-bd-dish-row>
          <label class="kp-formgrid__label" for="bd-add-dish">${t("bad.dishNl")}</label>
          <div class="kp-formgrid__control">
            <input class="kp-field__input" id="bd-add-dish" name="dish" type="text" autocomplete="off"
              aria-describedby="bd-add-dish-note" />
          </div>
          <p class="kp-formgrid__value" id="bd-add-dish-note" role="status" aria-live="polite" data-bd-dish-note>${t("bad.dishHint")}</p>
        </div>
        <div class="kp-formgrid__row" data-bd-dish-en-row>
          <label class="kp-formgrid__label" for="bd-add-dish-en">${t("bad.dishEn")}</label>
          <div class="kp-formgrid__control">
            <input class="kp-field__input" id="bd-add-dish-en" name="dish_en" type="text" autocomplete="off"
              aria-describedby="bd-add-dish-en-note" />
          </div>
          <p class="kp-formgrid__value" id="bd-add-dish-en-note" role="status" aria-live="polite" data-bd-dish-en-note>${t("bad.dishEnHint")}</p>
        </div>
        <div class="kp-formgrid__row">
          <label class="kp-formgrid__label" for="bd-add-from">${t("rec.dishLink")}</label>
          <div class="kp-formgrid__control">
            <select class="kp-field__input" id="bd-add-from" data-bd-from><option value="">${t("rec.noDish")}</option></select>
          </div>
          <p class="kp-formgrid__value">${t("rec.dishLinkHint")}</p>
        </div>
        <div class="kp-formgrid__row">
          <label class="kp-formgrid__label" for="bd-add-portions">${t("bad.colPortions")}</label>
          <div class="kp-formgrid__control">
            <div class="kp-quantity kp-formgrid__short" data-kp-quantity data-kp-quantity-min="1" data-kp-quantity-max="24"
              data-kp-quantity-unit="${t("bad.unitMany")}" data-kp-quantity-unit-one="${t("bad.unitOne")}" data-kp-quantity-label="${t("bad.colPortions")}" data-bd-portions>
              <input class="kp-quantity__input" id="bd-add-portions" value="2" />
            </div>
          </div>
          <p class="kp-formgrid__value">${t("bad.portionsHint")}</p>
        </div>
        <div class="kp-formgrid__row" data-bd-date-row>
          <label class="kp-formgrid__label" for="bd-add-date">${t("bad.colFrozen")}</label>
          <div class="kp-formgrid__control">
            <div class="kp-datepicker" data-kp-datepicker lang="${lang() === "nl" ? "nl-BE" : "en-GB"}" data-bd-date>
              <input class="kp-field__input" id="bd-add-date" type="text" inputmode="numeric" data-kp-date-input
                aria-describedby="bd-add-date-note" />
              <button type="button" class="kp-button" data-kp-date-open aria-label="${t("bad.openCalendar")}" title="${t("bad.openCalendar")}">
                <span aria-hidden="true">&#9638;</span>
              </button>
              <div class="kp-datepicker__panel" data-kp-date-panel hidden></div>
            </div>
          </div>
          <p class="kp-formgrid__value" id="bd-add-date-note" role="status" aria-live="polite" data-bd-date-note>${t("bad.dateHint")}</p>
        </div>
        <div class="kp-formgrid__row kp-formgrid__row--buttons">
          <div class="kp-formgrid__control">
            <button type="submit" class="kp-button kp-button--primary" data-kp-submit data-bd-add-submit>${t("bad.addSubmit")}</button>
          </div>
        </div>
        </div>
      </form>
    </div>
  </section>

  <section class="bd-sec" id="zero-prep" aria-labelledby="h-zero-prep">
    <div class="bd-sec__head">
      <h2 id="h-zero-prep">${t("bad.secShelf")}</h2>
      <p>
        ${t("bad.secShelfText")}
      </p>
    </div>
    <section class="kp-card bd-card" id="bd-shelf-card" data-kp-state="loading" aria-labelledby="bd-shelf-t"
      data-kp-loading-words="${t("bad.loadingShelf")}">
      <div class="kp-card__header">
        <h3 class="kp-card__title" id="bd-shelf-t">${t("bad.shelfTitle")}</h3>
        <div class="kp-card__actions">
          <div class="kp-segmented" data-kp-segmented="single" role="radiogroup" aria-label="${t("bad.levelLabel")}" data-bd-level>
            <button type="button" class="kp-segmented__item" role="radio" aria-checked="false" data-value="open">
              <span class="kp-segmented__label">${t("rec.energyOpen")}</span><span class="kp-segmented__count"></span>
            </button>
            <button type="button" class="kp-segmented__item" role="radio" aria-checked="false" data-value="easy">
              <span class="kp-segmented__label">${t("rec.energyEasy")}</span><span class="kp-segmented__count"></span>
            </button>
            <button type="button" class="kp-segmented__item" role="radio" aria-checked="true" data-value="any">
              <span class="kp-segmented__label">${t("rec.energyAny")}</span><span class="kp-segmented__count"></span>
            </button>
          </div>
          <button type="button" class="kp-button kp-button--primary" data-bd-shelf-add>${t("bad.addFood")}</button>
        </div>
      </div>
      <p class="kp-card__body">${t("bad.shelfBody")}</p>
      <div class="kp-card__stage">
        <div class="kp-card__data">
          <ul class="kp-action-list kp-action-list--lead bd-shelf" aria-label="${t("bad.shelfLabel")}" data-bd-shelf></ul>
        </div>
      </div>
      <div class="kp-card__footer"><p class="bd-readout" role="status" data-bd-shelf-readout>${t("bad.shelfReadout")}</p></div>
    </section>
  </section>

  <section class="bd-sec" id="mini-recipe" aria-labelledby="h-mini-recipe">
    <div class="bd-sec__head">
      <h2 id="h-mini-recipe">${t("bad.secMini")}</h2>
      <p>
        ${t("bad.secMiniText")}
      </p>
    </div>
    <div class="bd-mini">
      <div class="bd-mini__head">
        <h3 class="bd-mini__title" data-bd-mini-title>${t("bad.miniDefault")}</h3>
        <div class="kp-segmented" data-kp-segmented="single" role="radiogroup" aria-label="${t("bad.versionLabel")}" data-bd-version>
          <button type="button" class="kp-segmented__item" role="radio" aria-checked="true" data-value="mini">
            <span class="kp-segmented__label">${t("bad.miniVersion")}</span>
          </button>
          <button type="button" class="kp-segmented__item" role="radio" aria-checked="false" data-value="full">
            <span class="kp-segmented__label">${t("bad.fullRecipe")}</span>
          </button>
        </div>
        <a class="kp-button kp-button--primary bd-mini__cook" aria-disabled="true" data-bd-cook>${t("bad.cookThis")}</a>
      </div>
      <p class="kp-lede bd-mini__lede" data-bd-mini-lede></p>
      <div class="kp-focus-steps bd-mini__steps" data-kp-focus-steps aria-label="${t("bad.miniLabel")}" data-bd-steps
        data-kp-focus-steps-empty="${t("bad.noSteps")}"></div>
    </div>
  </section>

  <section class="bd-sec" id="freezer-month" aria-labelledby="h-freezer-month">
    <div class="bd-sec__head">
      <h2 id="h-freezer-month">${t("bad.secMonth")}</h2>
      <p>
        ${t("bad.secMonthText")}
      </p>
    </div>
    <div class="bd-calwrap">
      <section class="kp-calendar kp-calendar--busy-whole" id="bd-cal" data-kp-calendar data-kp-tones="calm"
        aria-label="${t("bad.calLabel")}"></section>
    </div>
  </section>
`;
