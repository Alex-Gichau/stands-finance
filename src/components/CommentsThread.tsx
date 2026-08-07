import React, { useEffect, useState, useRef } from "react";
import { databaseService } from "../lib/databaseService";
import { UserProfile } from "../types";
import { formatDate } from "../lib/utils";
import { Send, CornerDownLeft } from "lucide-react";

type Comment = {
  id: string;
  requisition_id: string;
  author_id: string;
  author_name: string;
  content: string;
  timestamp: string;
};

export const CommentsThread: React.FC<{
  requisitionId: string;
  currentUser?: UserProfile | null;
}> = ({ requisitionId, currentUser }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const mounted = useRef(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    mounted.current = true;
    const load = async () => {
      setLoading(true);
      const res = await databaseService.getCommentsForRequisition(requisitionId);
      if (!mounted.current) return;
      setComments(res || []);
      setLoading(false);
      // scroll to bottom
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 50);
    };
    load();

    // simple poll to refresh comments every 10s
    const t = setInterval(load, 10000);
    return () => { mounted.current = false; clearInterval(t); };
  }, [requisitionId]);

  const handlePost = async () => {
    if (!newComment.trim()) return;
    if (!currentUser) {
      // fallback anonymous
    }
    setPosting(true);
    const authorId = currentUser?.id || "anonymous";
    const authorName = currentUser?.name || currentUser?.email || "Anonymous";

    // optimistic update
    const optimistic: Comment = {
      id: `c-${Date.now()}`,
      requisition_id: requisitionId,
      author_id: authorId,
      author_name: authorName,
      content: newComment.trim(),
      timestamp: new Date().toISOString()
    };
    setComments((c) => [...c, optimistic]);
    setNewComment("");
    try {
      await databaseService.postComment(requisitionId, authorId, authorName, optimistic.content);
      // refresh list
      const refreshed = await databaseService.getCommentsForRequisition(requisitionId);
      if (mounted.current) setComments(refreshed || []);
    } catch (e) {
      console.error("Failed posting comment", e);
    } finally {
      if (mounted.current) setPosting(false);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }), 50);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">Comments & Discussion</h5>
        <span className="text-[10px] text-slate-500">{comments.length}</span>
      </div>

      <div ref={scrollRef} className="max-h-[220px] overflow-y-auto space-y-2 p-2 bg-slate-950/60 border border-slate-800 rounded-lg">
        {loading ? (
          <div className="text-xs text-slate-400">Loading comments…</div>
        ) : comments.length === 0 ? (
          <div className="text-[11px] text-slate-400">No comments yet. Start the conversation.</div>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="bg-slate-900/60 border border-slate-800 rounded-md p-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-md bg-slate-800 flex items-center justify-center text-slate-300 font-bold text-xs">
                    {c.author_name ? c.author_name.charAt(0).toUpperCase() : "A"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-200 truncate">{c.author_name}</p>
                    <p className="text-[10px] text-slate-500 font-mono">{formatDate(c.timestamp)}</p>
                  </div>
                </div>
                <div className="text-[11px] text-slate-400 ml-2"><CornerDownLeft size={14} /></div>
              </div>
              <div className="mt-2 text-[13px] text-slate-100 leading-snug">{c.content}</div>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center gap-2">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Leave a comment or feedback..."
          className="flex-1 min-h-[56px] resize-none p-2 text-sm bg-slate-900/70 border border-slate-800 rounded-md placeholder-slate-500 text-slate-100"
        />
        <button
          onClick={handlePost}
          disabled={posting || !newComment.trim()}
          className={`px-3 py-2 rounded-md text-sm font-bold ${posting || !newComment.trim() ? "bg-slate-800 text-slate-500 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-500 text-white"}`}
          title="Post comment"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
};

export default CommentsThread;
