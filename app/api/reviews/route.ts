import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { reviews } from "../../../db/schema";

export const dynamic = "force-dynamic";

const maxBodyBytes = 16 * 1024;
const receiptPattern = /^[a-z0-9 #./-]+$/i;
const submissionIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function readBody(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) return null;

  const decoder = new TextDecoder();
  let bytes = 0;
  let content = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBodyBytes) {
        await reader.cancel();
        return json({ error: "This review is too long to submit." }, 413);
      }
      content += decoder.decode(value, { stream: true });
    }
    return JSON.parse(content + decoder.decode());
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

export async function GET() {
  try {
    const published = await getDb()
      .select({ id: reviews.id, rating: reviews.rating, text: reviews.text, date: reviews.date })
      .from(reviews)
      .where(eq(reviews.published, true))
      .orderBy(desc(reviews.date), desc(reviews.id));
    return json({ reviews: published.map(review => ({ ...review, id: String(review.id) })) });
  } catch {
    return json({ error: "We couldn't load guest reviews. Please try again." }, 503);
  }
}

export async function POST(request: Request) {
  if (request.headers.get("Sec-Fetch-Site") === "cross-site") {
    return json({ error: "Please submit your review from the feedback page." }, 403);
  }
  if (request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return json({ error: "Please send this review as JSON." }, 415);
  }

  const body = await readBody(request);
  if (body instanceof Response) return body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "Please check the review form and try again." }, 400);
  }

  const { receipt, rating, text, submissionId } = body as Record<string, unknown>;
  const receiptNumber = typeof receipt === "string" ? receipt.trim() : "";
  if (!receiptNumber || receiptNumber.length > 64 || !receiptPattern.test(receiptNumber) || !/[a-z0-9]/i.test(receiptNumber)) {
    return json({ error: "Enter the receipt number printed on your receipt." }, 400);
  }
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return json({ error: "Choose a rating from 1 to 5 stars." }, 400);
  }
  const reviewText = typeof text === "string" ? text.trim() : "";
  if (!reviewText || reviewText.length > 2000 || reviewText.includes("\0")) {
    return json({ error: "Write a review between 1 and 2,000 characters." }, 400);
  }
  if (typeof submissionId !== "string" || !submissionIdPattern.test(submissionId)) {
    return json({ error: "Reopen the review form and try again." }, 400);
  }

  try {
    const db = getDb();
    const [saved] = await db.insert(reviews)
      .values({ submissionId, rating, text: reviewText })
      .onConflictDoNothing({ target: reviews.submissionId })
      .returning({ id: reviews.id });
    if (saved) return json({ ok: true }, 201);

    const [previous] = await db
      .select({ rating: reviews.rating, text: reviews.text })
      .from(reviews)
      .where(eq(reviews.submissionId, submissionId));
    if (previous?.rating === rating && previous.text === reviewText) {
      return json({ ok: true });
    }
    return json({ error: "This form already sent a different review. Reopen it to start a new one." }, 409);
  } catch {
    return json({ error: "We couldn't save your review. Please try again." }, 503);
  }
}
