"use client";

import type { PinRow } from "@/actions/classes";

// 등록 직후 보여주는 이름·비밀번호 표(인쇄용). 비밀번호는 저장되지 않으니 지금 인쇄하거나 적어 두어야 한다.
export function PinTable({ rows, classCode }: { rows: PinRow[]; classCode: string }) {
  return (
    <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
      <p className="no-print mb-2 text-sm font-semibold text-amber-900">
        학급코드·이름·비밀번호 표예요. 인쇄해서 나눠 주세요. 모두 같은 처음 비밀번호를 쓰면 친구 계정으로도 들어갈 수 있으니, 필요하면 학생별로 바꿔 주세요.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b">
              <th className="py-1 pr-3">학급코드</th>
              <th className="py-1 pr-3">이름</th>
              <th className="py-1">비밀번호</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-b border-amber-200">
                <td className="py-1 pr-3 font-mono">{classCode}</td>
                <td className="py-1 pr-3">{r.name}</td>
                <td className="py-1 font-mono text-lg font-bold tracking-widest">{r.pin}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={() => window.print()} className="no-print mt-2 rounded-md border border-stone-300 bg-white px-3 py-1 text-sm">
        인쇄하기
      </button>
    </div>
  );
}
