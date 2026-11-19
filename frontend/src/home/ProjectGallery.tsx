import { useState } from "react";
import { SimpleGrid, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listSpaces } from "../api/spaces";
import { sectionOf, SPACE_SECTIONS } from "../documents/spaceKind";
import type { SpaceDto } from "../api/spaces";
import { Panel } from "./Panel";
import { DEFAULT_PROJECT_COVER, GALLERY_LIMIT, projectPreview } from "./projectPreview";

// 카드 윗부분: 사이드바와 같은 프로젝트 아이콘을 가운데에 크게, 아이콘이 없거나 그림을 불러오지 못하면 폴더 그림
function CardPreview({ space }: { space: SpaceDto }) {
  const preview = projectPreview(space);
  const [broken, setBroken] = useState(false);
  return (
    <div className="project-card-preview project-card-icon-preview">
      {preview.kind === "emoji" ? (
        <span className="project-card-emoji" aria-hidden>{preview.emoji}</span>
      ) : (
        <img src={broken ? DEFAULT_PROJECT_COVER : preview.src} alt="" draggable={false} referrerPolicy="no-referrer"
          onError={() => setBroken(true)} />
      )}
    </div>
  );
}

// 메인 화면 프로젝트 카드 모음 (사이드바처럼 내부·외부 프로젝트 칸을 나눠 칸마다 사이드바 순서 상위 10개)
export function ProjectGallery() {
  // 사이드바와 같은 조회 키라 순서·아이콘·이름이 같이 바뀜
  const { data: spaces = [] } = useQuery({ queryKey: ["spaces"], queryFn: listSpaces });
  // 메인 화면에는 프로젝트만 (최상위 페이지는 사이드바에만)
  const projects = spaces.filter((space) => space.kind === "PROJECT");
  return SPACE_SECTIONS.map(({ value, label }) => {
    const inSection = projects.filter((space) => sectionOf(space) === value);
    if (inSection.length === 0) return null;
    return <ProjectCards key={value} title={label} projects={inSection} />;
  });
}

function ProjectCards({ title, projects }: { title: string; projects: SpaceDto[] }) {
  return (
    <Panel title={title}>
      {/* 좁은 화면은 한 줄 3개, 카드 윗부분도 낮게 (index.css .project-card-preview) */}
      <SimpleGrid cols={{ base: 3, md: 5 }} spacing="sm">
        {projects.slice(0, GALLERY_LIMIT).map((space) => (
          <Link key={space.id} to={`/spaces/${space.id}`} className="project-card" draggable={false}>
            <CardPreview space={space} />
            {/* 아이콘은 윗부분에 크게 보이므로 이름 줄에는 이름만 */}
            <div className="project-card-name">
              <Text size="sm" fw={500} lineClamp={2}>{space.name}</Text>
            </div>
          </Link>
        ))}
      </SimpleGrid>
    </Panel>
  );
}
