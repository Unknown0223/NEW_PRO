import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import PageHeader from "./components/refunds/PageHeader";
import CustomerInfoCard from "./components/refunds/CustomerInfoCard";
import OrderInfoCard from "./components/refunds/OrderInfoCard";
import CategorySelector from "./components/refunds/CategorySelector";
import ProductTable from "./components/refunds/ProductTable";
import TotalsPanel from "./components/refunds/TotalsPanel";
import CommentBox from "./components/refunds/CommentBox";
import SubmitPanel from "./components/refunds/SubmitPanel";

export default function App() {
  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-900 antialiased">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />

        <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-6 lg:py-8">
          <div className="mx-auto max-w-7xl">
            <PageHeader />

            <div className="space-y-5">
              <CustomerInfoCard />
              <OrderInfoCard />
              <CategorySelector />
              <ProductTable />
              <TotalsPanel />
              <CommentBox />
              <SubmitPanel />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
