export function getCurrentDateInfo() {
	const now = new Date();
	const localDateTime = new Intl.DateTimeFormat("zh-CN", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
		weekday: "long",
		timeZoneName: "short",
	}).format(now);

	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");

	return {
		now,
		year,
		month,
		day,
		isoDate: `${year}-${month}-${day}`,
		localDateTime,
	};
}

export function getCurrentDateContext() {
	const { now, localDateTime } = getCurrentDateInfo();

	return [
		`当前服务器本地时间: ${localDateTime}`,
		"当明确要求有今天、当前时间、当前日期、最新、星期几等问题时，必须以这里提供的当前时间为准。",
	].join("\n");
}
