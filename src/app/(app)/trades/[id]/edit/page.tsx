"use client";

import { use } from "react";
import { TradeForm } from "@/components/TradeForm";

export default function EditTradePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <TradeForm tradeId={Number(id)} />;
}
