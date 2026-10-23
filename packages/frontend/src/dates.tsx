import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);
export const TIME_ZONE = "Asia/Dhaka";
export const campusDate = (date: Date | string | number) =>
  dayjs(date).tz(TIME_ZONE);
export const formatDateTime = (date: Date | string | number) =>
  campusDate(date).format("DD/MM/YYYY h:mm A");
export const toDateInput = (date: Date | string | number | null) =>
  date ? campusDate(date).format("YYYY-MM-DDTHH:mm") : "";
export function fromDateInput(value: string): string {
  const date = dayjs.tz(value, TIME_ZONE);
  if (!date.isValid()) throw new Error("Enter a valid date and time.");
  return date.toISOString();
}
