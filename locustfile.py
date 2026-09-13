from locust import HttpUser, task, between

class ValiStructUser(HttpUser):
    wait_time = between(0.5, 2.0)

    @task(3)
    def health(self):
        self.client.get("/health")

    @task(1)
    def monitor(self):
        self.client.get("/monitor")
