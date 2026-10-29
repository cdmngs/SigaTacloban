import { formatDate, formatDateTime, formatNumber, formatPercent, formatTemperature, formatTime, formatValue } from "../utils/format.js";

const readValue = (row, column) => row[column.key];
const visibleValue = (row, column) => column.render ? column.render(row) : readValue(row, column);

function formatCellValue(value, column) {
  if (column.formatter) return formatValue(column.formatter(value));
  if (column.type === "date") return formatDate(value);
  if (column.type === "datetime") return formatDateTime(value);
  if (column.type === "time") return formatTime(value);
  if (column.type === "percent") return formatPercent(value);
  if (column.type === "temperature") return formatTemperature(value);
  return typeof value === "number" ? formatNumber(value) : formatValue(value);
}

function appendCellContent(cell, value, column) {
  if (value instanceof Node) cell.append(value);
  else cell.textContent = formatCellValue(value, column);
}

export function renderDataTable(container, columns, rows, {
  pageSize = 10, emptyMessage = "No data yet", sortable = true, getRowId = null, selectedId = null, onSelect = null,
} = {}) {
  if (!(container instanceof HTMLElement) || !Array.isArray(columns) || !Array.isArray(rows)) {
    throw new TypeError("A table container, columns, and rows are required.");
  }
  let currentRows = [...rows];
  let page = 1;
  let sort = null;
  let currentSelectedId = selectedId;
  const selectable = typeof getRowId === "function" && typeof onSelect === "function";
  const media = window.matchMedia("(max-width: 767px)");
  const safePageSize = Math.max(1, Number(pageSize) || 10);

  const orderedRows = () => {
    if (!sort) return currentRows;
    const column = columns.find((item) => item.key === sort.key);
    if (!column) return currentRows;
    const sign = sort.direction === "asc" ? 1 : -1;
    return [...currentRows].sort((left, right) => {
      const first = readValue(left, column);
      const second = readValue(right, column);
      if (first == null && second == null) return 0;
      if (first == null) return 1;
      if (second == null) return -1;
      return (typeof first === "number" && typeof second === "number"
        ? first - second
        : String(first).localeCompare(String(second), undefined, { numeric: true, sensitivity: "base" })) * sign;
    });
  };
  const makePagination = (totalPages) => {
    const footer = document.createElement("nav");
    footer.className = "table-pagination";
    footer.setAttribute("aria-label", "Table pages");
    const previous = document.createElement("button");
    previous.type = "button";
    previous.className = "button button-secondary button-sm";
    previous.textContent = "Previous";
    previous.disabled = page <= 1;
    previous.addEventListener("click", () => { page = Math.max(1, page - 1); paint(); });
    const status = document.createElement("span");
    status.textContent = currentRows.length ? `Page ${page} of ${totalPages}` : "Page 0 of 0";
    const next = document.createElement("button");
    next.type = "button";
    next.className = "button button-secondary button-sm";
    next.textContent = "Next";
    next.disabled = page >= totalPages;
    next.addEventListener("click", () => { page = Math.min(totalPages, page + 1); paint(); });
    footer.append(previous, status, next);
    return footer;
  };
  const paint = () => {
    const ordered = orderedRows();
    const totalPages = Math.max(1, Math.ceil(ordered.length / safePageSize));
    page = Math.min(page, totalPages);
    const pageRows = ordered.slice((page - 1) * safePageSize, page * safePageSize);
    if (media.matches) {
      const cards = document.createElement("div");
      cards.className = "mobile-table";
      cards.setAttribute("aria-label", "Data table, card layout");
      if (!pageRows.length) {
        const empty = document.createElement("div");
        empty.className = "empty-state table-empty-state";
        empty.textContent = formatValue(emptyMessage);
        cards.append(empty);
      }
      for (const row of pageRows) {
        const card = document.createElement("article");
        card.className = "mobile-table-row";
        if (selectable) {
          const rowId = getRowId(row);
          card.setAttribute("aria-selected", String(Object.is(rowId, currentSelectedId)));
          card.tabIndex = 0;
          card.addEventListener("click", () => selectRow(row));
          card.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectRow(row); }
          });
        }
        for (const [index, column] of columns.entries()) {
          const field = document.createElement("div");
          if (index === 0) field.classList.add("mobile-table-primary");
          const label = document.createElement("small");
          label.textContent = formatValue(column.label);
          const value = document.createElement("span");
          appendCellContent(value, visibleValue(row, column), column);
          field.append(label, value);
          card.append(field);
        }
        cards.append(card);
      }
      container.replaceChildren(cards, makePagination(totalPages));
      return;
    }
    const wrapper = document.createElement("div");
    wrapper.className = "table-wrap";
    const table = document.createElement("table");
    table.className = "data-table";
    const head = document.createElement("thead");
    const headerRow = document.createElement("tr");
    for (const column of columns) {
      const cell = document.createElement("th");
      cell.scope = "col";
      const canSort = sortable && column.sortable !== false && column.key !== undefined;
      if (canSort) {
        cell.setAttribute("aria-sort", sort?.key === column.key ? (sort.direction === "asc" ? "ascending" : "descending") : "none");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "table-sort-button";
        button.textContent = formatValue(column.label);
        button.addEventListener("click", () => {
          sort = { key: column.key, direction: sort?.key === column.key && sort.direction === "asc" ? "desc" : "asc" };
          page = 1;
          paint();
        });
        cell.append(button);
      } else cell.textContent = formatValue(column.label);
      headerRow.append(cell);
    }
    head.append(headerRow);
    const body = document.createElement("tbody");
    if (!pageRows.length) {
      const emptyRow = document.createElement("tr");
      const emptyCell = document.createElement("td");
      emptyCell.colSpan = Math.max(1, columns.length);
      emptyCell.className = "table-empty-state";
      emptyCell.textContent = formatValue(emptyMessage);
      emptyRow.append(emptyCell);
      body.append(emptyRow);
    }
    for (const row of pageRows) {
      const tableRow = document.createElement("tr");
      if (selectable) {
        tableRow.tabIndex = 0;
        tableRow.setAttribute("aria-selected", String(Object.is(getRowId(row), currentSelectedId)));
        tableRow.addEventListener("click", (event) => {
          if (!event.target.closest("button,a,input,select,textarea")) selectRow(row);
        });
        tableRow.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectRow(row); }
        });
      }
      for (const column of columns) {
        const cell = document.createElement("td");
        appendCellContent(cell, visibleValue(row, column), column);
        tableRow.append(cell);
      }
      body.append(tableRow);
    }
    table.append(head, body);
    wrapper.append(table);
    container.replaceChildren(wrapper, makePagination(totalPages));
  };
  const onMediaChange = () => paint();
  const selectRow = (row) => {
    currentSelectedId = getRowId(row);
    paint();
    onSelect(row);
  };
  media.addEventListener("change", onMediaChange);
  paint();
  return {
    setRows(nextRows) {
      if (!Array.isArray(nextRows)) throw new TypeError("Table rows must be an array.");
      currentRows = [...nextRows];
      if (selectable && !currentRows.some((row) => Object.is(getRowId(row), currentSelectedId))) currentSelectedId = null;
      paint();
    },
    get selectedId() { return currentSelectedId; },
    setPage(nextPage) {
      page = Math.max(1, Number(nextPage) || 1);
      paint();
    },
    setSort(nextSort) {
      if (nextSort !== null && (!columns.some((column) => column.key === nextSort.key) || !["asc", "desc"].includes(nextSort.direction))) {
        throw new TypeError("Table sort must identify a column and an asc/desc direction.");
      }
      sort = nextSort ? { ...nextSort } : null;
      paint();
    },
    destroy() {
      media.removeEventListener("change", onMediaChange);
      container.replaceChildren();
    },
  };
}
