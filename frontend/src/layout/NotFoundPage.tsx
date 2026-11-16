import { useNavigate } from "react-router-dom";
import { ErrorPage } from "./ErrorPage";

// 없는 주소로 들어왔을 때 (사이드바는 그대로 두고 본문에 404 표시)
export function NotFoundPage() {
  const navigate = useNavigate();
  return <ErrorPage code="404" inLayout actionLabel="첫 화면으로" onAction={() => navigate("/main")} />;
}
