import { CheckIcon, CloseIcon } from "./icons";

/** What each role can do, and whether staff can too (admins can do all of it). */
const CAN: [what: string, staff: boolean][] = [
  ["See the QR codes, prizes, map, event and team", true],
  ["Change QR codes, clues and pins", false],
  ["Change prizes and their stock", false],
  ["Change the dates and test mode", false],
  ["Add, reset or remove teammates", false],
];

const Yes = () => (
  <span className="can__yes">
    <CheckIcon />
    <span className="sr-only">Yes</span>
  </span>
);
const No = () => (
  <span className="can__no">
    <CloseIcon />
    <span className="sr-only">No</span>
  </span>
);

/** Admin and staff side by side; `mine` marks your own role's column. */
export function RoleTable({ mine }: { mine?: "admin" | "staff" }) {
  return (
    <table className="can">
      <thead>
        <tr>
          <th scope="col">
            <span className="sr-only">What</span>
          </th>
          <th scope="col" className={mine === "admin" ? "is-mine" : undefined}>
            Admin
          </th>
          <th scope="col" className={mine === "staff" ? "is-mine" : undefined}>
            Staff
          </th>
        </tr>
      </thead>
      <tbody>
        {CAN.map(([what, staff]) => (
          <tr key={what}>
            <th scope="row">{what}</th>
            <td className={mine === "admin" ? "is-mine" : undefined}>
              <Yes />
            </td>
            <td className={mine === "staff" ? "is-mine" : undefined}>{staff ? <Yes /> : <No />}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
