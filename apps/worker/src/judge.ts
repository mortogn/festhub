import {
  outputsMatch,
  parseJudgeLimits,
  type JudgeLimits,
  type Verdict,
} from "@festhub/shared/contest";

export type JudgeResult = {
  verdict: Verdict;
  executionTime: number | null;
  memoryUsed: number | null;
  compileOutput: string | null;
};
export type JudgeInput = {
  sourceCode: string;
  languageCode: number;
  stdin: string;
  cpuLimit: number;
  memoryLimit: number;
};
type ResponseData = {
  token?: string;
  status?: { id: number };
  stdout?: string | null;
  compile_output?: string | null;
  time?: string | null;
  memory?: number | null;
};

export class JudgeClient {
  private limits: Promise<JudgeLimits> | undefined;
  constructor(
    private url: string,
    private token: string,
    private request: typeof fetch = fetch,
    private pollInterval = 1000,
    private pollTimeout = 120000,
  ) {}

  private async json<T = ResponseData>(path: string, init: RequestInit = {}) {
    const response = await this.request(
      `${this.url.replace(/\/$/, "")}${path}`,
      {
        ...init,
        signal: AbortSignal.timeout(10000),
        headers: {
          "Content-Type": "application/json",
          "X-Auth-Token": this.token,
        },
      },
    );
    if (!response.ok)
      throw new Error(`Judge0 request failed (${response.status})`);
    return (await response.json()) as T;
  }

  async create(input: JudgeInput) {
    this.limits ??= this.json<Record<string, unknown>>("/config_info")
      .then(parseJudgeLimits)
      .catch((error) => {
        this.limits = undefined;
        throw error;
      });
    const limits = await this.limits;
    if (
      input.cpuLimit > limits.max_cpu_time_limit ||
      input.memoryLimit > limits.max_memory_limit
    )
      throw new Error("Problem limits exceed Judge0 configuration");
    const response = await this.json(
      "/submissions?base64_encoded=true&wait=false",
      {
        method: "POST",
        body: JSON.stringify({
          source_code: Buffer.from(input.sourceCode).toString("base64"),
          stdin: Buffer.from(input.stdin).toString("base64"),
          language_id: input.languageCode,
          cpu_time_limit: input.cpuLimit,
          memory_limit: input.memoryLimit,
          wall_time_limit: Math.min(
            limits.max_wall_time_limit,
            Math.max(10, input.cpuLimit * 5),
          ),
          enable_network: false,
          number_of_runs: 1,
          max_file_size: 1024,
        }),
      },
    );
    if (!response.token) throw new Error("Judge0 returned no submission token");
    return response.token;
  }

  async result(token: string, expected: string): Promise<JudgeResult> {
    const deadline = Date.now() + this.pollTimeout;
    while (Date.now() < deadline) {
      const result = await this.json(
        `/submissions/${encodeURIComponent(token)}?base64_encoded=true&fields=status,stdout,compile_output,time,memory`,
      );
      const status = result.status?.id;
      if (status === 1 || status === 2) {
        await new Promise((resolve) => setTimeout(resolve, this.pollInterval));
        continue;
      }
      let verdict: Verdict;
      if (status === 3)
        verdict = outputsMatch(
          Buffer.from(result.stdout ?? "", "base64").toString("utf8"),
          expected,
        )
          ? "AC"
          : "WA";
      else if (status === 4) verdict = "WA";
      else if (status === 5) verdict = "TLE";
      else if (status === 6) verdict = "CE";
      else if (status && ((status >= 7 && status <= 12) || status === 14))
        verdict = "RE";
      else
        throw new Error(
          `Judge0 infrastructure failure (status ${status ?? "missing"})`,
        );
      const time = result.time == null ? null : Number(result.time);
      return {
        verdict,
        executionTime: time !== null && Number.isFinite(time) ? time : null,
        memoryUsed: result.memory ?? null,
        compileOutput:
          verdict === "CE" && result.compile_output
            ? Buffer.from(result.compile_output, "base64")
                .toString("utf8")
                .slice(0, 8192)
            : null,
      };
    }
    throw new Error("Judge0 polling timed out");
  }
}
