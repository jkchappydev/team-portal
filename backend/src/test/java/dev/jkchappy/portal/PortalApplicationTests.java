package dev.jkchappy.portal;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

@Import(TestcontainersConfig.class)
@SpringBootTest
class PortalApplicationTests {

	@Autowired
	private ThreadPoolTaskScheduler taskScheduler;

	@Test
	void contextLoads() {
	}

	// 다른 서버 응답을 기다리는 주기 작업 때문에 서버 상태 전송이 밀리지 않도록 스레드가 여러 개여야 함
	@Test
	void taskScheduler_usesMoreThanOneThread() {
		assertThat(taskScheduler.getPoolSize()).isGreaterThan(1);
	}

}
