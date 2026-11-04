package dev.jkchappy.portal;

import org.springframework.boot.SpringApplication;

public class TestPortalApplication {

	public static void main(String[] args) {
		SpringApplication.from(PortalApplication::main).with(TestcontainersConfig.class).run(args);
	}

}
