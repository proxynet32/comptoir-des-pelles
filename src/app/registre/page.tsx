import Link from "next/link";
import { prisma, ensurePrismaReady } from "@/lib/prisma";
import Certificat from "@/components/Certificat";
import styles from "./registre.module.css";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 9;

type SearchParams = {
  page?: string;
  metier?: string;
  sort?: string;
};

function buildHref(params: SearchParams, overrides: Partial<SearchParams>) {
  const merged = { ...params, ...overrides };
  const usp = new URLSearchParams();
  if (merged.metier && merged.metier !== "all") usp.set("metier", merged.metier);
  if (merged.sort && merged.sort !== "recent") usp.set("sort", merged.sort);
  if (merged.page && merged.page !== "1") usp.set("page", merged.page);
  const qs = usp.toString();
  return `/registre${qs ? `?${qs}` : ""}`;
}

export default async function RegistrePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const currentPage = Math.max(1, Number(searchParams.page) || 1);
  const metierFilter = searchParams.metier && searchParams.metier !== "all"
    ? searchParams.metier
    : undefined;
  const sort = searchParams.sort === "metier" ? "metier" : "recent";

  const where = metierFilter ? { metier: metierFilter } : {};
  const orderBy =
    sort === "metier"
      ? [{ metier: "asc" as const }, { createdAt: "desc" as const }]
      : [{ createdAt: "desc" as const }];

  await ensurePrismaReady();

  const [total, agents, metierRows] = await Promise.all([
    prisma.agent.count({ where }),
    prisma.agent.findMany({
      where,
      orderBy,
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.agent.findMany({
      select: { metier: true },
      distinct: ["metier"],
      orderBy: { metier: "asc" },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const metiers = metierRows.map((row) => row.metier);

  return (
    <main>
      <div className={styles.toolbar}>
        <form className={styles.filterGroup} method="get">
          <div className={styles.field}>
            <label className={styles.label} htmlFor="metier">
              Métier
            </label>
            <select
              id="metier"
              name="metier"
              className={styles.select}
              defaultValue={metierFilter ?? "all"}
            >
              <option value="all">Tous les métiers</option>
              {metiers.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="sort">
              Tri
            </label>
            <select
              id="sort"
              name="sort"
              className={styles.select}
              defaultValue={sort}
            >
              <option value="recent">Plus récents</option>
              <option value="metier">Métier (A-Z)</option>
            </select>
          </div>
          <button
            type="submit"
            className={styles.select}
            style={{ cursor: "pointer" }}
          >
            Filtrer
          </button>
        </form>
        <span className={styles.count}>
          {total} concession{total > 1 ? "s" : ""} enregistrée
          {total > 1 ? "s" : ""}
        </span>
      </div>

      {agents.length === 0 ? (
        <div className={styles.empty}>
          Aucune concession ne correspond à ce filtre pour l&apos;instant.
        </div>
      ) : (
        <div className={styles.grid}>
          {agents.map((agent) => (
            <Certificat
              key={agent.id}
              compact
              agent={{
                claimNumber: agent.claimNumber,
                metier: agent.metier,
                precision: agent.precision,
                prenom: agent.prenom,
                nomAgent: agent.nomAgent,
                role: agent.role,
                pitch: agent.pitch,
                traits: JSON.parse(agent.traits) as string[],
                statut: agent.statut,
                createdAt: agent.createdAt,
              }}
            />
          ))}
        </div>
      )}

      <div className={styles.pagination}>
        <Link
          href={buildHref(searchParams, { page: String(currentPage - 1) })}
          className={currentPage <= 1 ? styles.disabledLink : ""}
          aria-disabled={currentPage <= 1}
        >
          ← Précédent
        </Link>
        <span className={styles.pageInfo}>
          Page {currentPage} / {totalPages}
        </span>
        <Link
          href={buildHref(searchParams, { page: String(currentPage + 1) })}
          className={currentPage >= totalPages ? styles.disabledLink : ""}
          aria-disabled={currentPage >= totalPages}
        >
          Suivant →
        </Link>
      </div>
    </main>
  );
}
