import { createRoot } from "react-dom/client";
import { PivotApp } from "@salec/pivot-ui";
import "@salec/pivot-ui/style.css";

const fields = [
  { id: "Country", label: "Country", dataType: "string" as const },
  { id: "Category", label: "Category", dataType: "string" as const },
  { id: "Price", label: "Price", dataType: "currency" as const }
];

const data = [
  { Country: "UZ", Category: "A", Price: 1000 },
  { Country: "UZ", Category: "B", Price: 2500 },
  { Country: "KZ", Category: "A", Price: 1800 },
  { Country: "KZ", Category: "B", Price: 900 }
];

createRoot(document.getElementById("root")!).render(
  <PivotApp data={data} fields={fields} options={{ locale: "ru", drillThrough: true, theme: "striped" }} />
);
