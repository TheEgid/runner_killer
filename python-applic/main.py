from prefect import flow # type: ignore
from dotenv import load_dotenv # type: ignore

from light_pipeline import LightPipeline


@flow(log_prints=True)
def seo_content_pipeline_light(resume: bool = True):
    load_dotenv()
    return LightPipeline(resume).run()


if __name__ == "__main__":
    seo_content_pipeline_light.from_source(
        source=".",
        entrypoint="main.py:seo_content_pipeline_light",
    ).deploy(
        name="seo_content_pipeline_light",
        work_pool_name="default",
        parameters={"resume": True}
    )


