import { createClient } from "@/lib/supabase/server";
import { Badge, Card } from "@/components/ui/card";
import { formatDate } from "@/lib/domain";
import { getT } from "@/lib/i18n/server";
import { AnswerForm, AskQuestionForm } from "./question-forms";

type QuestionRow = { id: string; question: string; answer: string | null; created_at: string; answered_at: string | null };

/**
 * Public questions and answers on a job. What each person sees is decided in the database: everyone who can
 * see the job reads answered questions; unanswered ones are visible only to the requester and the asker.
 * Askers are never shown, except to their own company (as "Your question").
 */
export async function QuestionsSection({
  jobId,
  isRequester,
  canAsk,
  canAnswer,
}: {
  jobId: string;
  isRequester: boolean;
  /** A signed-in active company that is not the requester, while the job is open. */
  canAsk: boolean;
  /** The requester's company is active and the job is open. */
  canAnswer: boolean;
}) {
  const t = await getT();
  const supabase = await createClient();
  const { data } = await supabase
    .from("job_questions")
    .select("id, question, answer, created_at, answered_at")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });
  const questions = (data ?? []) as QuestionRow[];

  // Only the asking company can read this table, so it marks "your" questions without naming anyone.
  const mine = new Set<string>();
  if (!isRequester && questions.length > 0) {
    const { data: own } = await supabase.from("job_question_authors").select("question_id");
    for (const r of own ?? []) mine.add(r.question_id as string);
  }

  if (questions.length === 0 && !canAsk) return null;

  return (
    <section aria-labelledby="questions-heading" className="space-y-3">
      <h2 id="questions-heading" className="font-semibold">
        {t("Questions and answers")}
      </h2>
      {questions.length === 0 ? <p className="text-sm text-muted-foreground">{t("No questions yet.")}</p> : null}
      <ul className="space-y-3">
        {questions.map((q) => (
          <li key={q.id}>
            <Card className="space-y-2" data-testid="question">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium whitespace-pre-wrap">{q.question}</p>
                {mine.has(q.id) ? <Badge tone="verified">{t("Your question")}</Badge> : null}
              </div>
              <p className="text-xs text-muted-foreground">{t("Asked {date}", { date: formatDate(q.created_at) })}</p>
              {q.answer ? (
                <div className="rounded-xl bg-sea-soft p-3 text-sm text-sea-ink">
                  <p className="font-semibold">{t("Answer from the requester")}</p>
                  <p className="whitespace-pre-wrap">{q.answer}</p>
                </div>
              ) : isRequester && canAnswer ? (
                <AnswerForm jobId={jobId} questionId={q.id} />
              ) : (
                <p className="text-sm text-muted-foreground">{t("Waiting for the requester to answer.")}</p>
              )}
            </Card>
          </li>
        ))}
      </ul>
      {canAsk ? (
        <Card>
          <AskQuestionForm jobId={jobId} />
        </Card>
      ) : null}
    </section>
  );
}
