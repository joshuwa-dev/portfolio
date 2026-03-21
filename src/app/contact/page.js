import PortfolioLayout from "../../../components/PortfolioLayout";
import GetUsers from "../../../utils/GetUsers";

export default function Contact() {
  return (
    <PortfolioLayout>
      <section className="section1">
        <div className="text-center text-xl lg:text-2xl font-light">
          Several ways to get across to me,
          <br />
          <span className="font-semibold text-slate-900">
            Let&#39;s Work Together :)
          </span>
        </div>
      </section>
      <section className="section2">
        <div className="pt-10">
          <GetUsers />
        </div>
      </section>
    </PortfolioLayout>
  );
}
