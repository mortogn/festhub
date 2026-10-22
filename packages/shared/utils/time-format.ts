import dayjs from "dayjs";
import localizedForamt from "dayjs/plugin/localizedFormat";

dayjs.extend(localizedForamt);

export function formatDateTime(date: Date | string | number) {
  return dayjs(date).format("L LT");
}
