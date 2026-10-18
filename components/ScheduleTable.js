import { schedule } from '../content/club';
import { formatDay, isOver, meetingPlace, meetingTime, nextMeeting } from '../lib/schedule';
import { useNow } from '../lib/useNow';

export default function ScheduleTable({ now: serverNow }) {
  const now = useNow(serverNow);
  const next = nextMeeting(schedule.meetings, now);
  return (
    <div className="table-scroll">
      <table className="schedule">
        <caption className="sr-only">{schedule.term} schedule</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Time</th>
            <th scope="col">Location</th>
            <th scope="col">What</th>
          </tr>
        </thead>
        <tbody>
          {schedule.meetings.map((m) => {
            const past = isOver(m, now);
            const isNext = next && next.date === m.date && next.start === m.start;
            const cls = [m.event ? 'is-event' : '', past ? 'is-past' : '', isNext ? 'is-next' : ''].join(' ').trim();
            return (
              <tr key={`${m.date}-${m.start}`} className={cls || undefined}>
                <td className="when">
                  {formatDay(m.date)}
                  {isNext && <span className="next-tag">Next</span>}
                </td>
                <td>{meetingTime(m)}</td>
                <td>{meetingPlace(m)}</td>
                <td>{m.what}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
