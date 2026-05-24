import { Icon } from "../Icon";
import { useRefundStore } from "../../store/refundStore";

export default function CommentBox() {
  const { comment, setComment } = useRefundStore();
  const max = 500;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-violet-50 text-violet-600">
          <Icon name="file-text" className="h-4 w-4" />
        </div>
        <h2 className="text-sm font-semibold text-slate-900">
          Комментарий к возврату
        </h2>
        <span className="ml-auto text-xs text-slate-500">
          {comment.length} / {max}
        </span>
      </div>

      <textarea
        value={comment}
        onChange={(e) => {
          if (e.target.value.length <= max) setComment(e.target.value);
        }}
        placeholder="Укажите причину возврата, особые условия, замечания оператора..."
        rows={4}
        className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      />
      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-1">
          <Icon name="shield" className="h-3.5 w-3.5 text-emerald-500" />
          <span>Данные защищены и будут переданы только ответственному менеджеру</span>
        </div>
        <button
          type="button"
          onClick={() => setComment("")}
          disabled={!comment}
          className="text-slate-500 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Очистить
        </button>
      </div>
    </div>
  );
}
