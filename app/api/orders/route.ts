import { NextResponse } from "next/server";
import { buildOrder, validateOrder, type NewOrderInput } from "@/lib/orders";
import { getOrderStore } from "@/lib/orders-store";

export const runtime = "nodejs";

/** POST /api/orders — sipariş oluştur. Gövde: NewOrderInput. 201 → { id } */
export async function POST(req: Request) {
  let input: NewOrderInput;
  try {
    input = (await req.json()) as NewOrderInput;
  } catch {
    return NextResponse.json({ errors: [{ field: "body", code: "invalid-json" }] }, { status: 400 });
  }
  const errors = validateOrder(input);
  if (errors.length) return NextResponse.json({ errors }, { status: 422 });
  const order = await getOrderStore().create(buildOrder(input));
  return NextResponse.json({ id: order.id, order }, { status: 201 });
}
